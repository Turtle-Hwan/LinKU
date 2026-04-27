/**
 * Google Analytics 4 Measurement Protocol for Chrome Extension
 * Manifest V3 호환 - CSP 제약 없이 Analytics 사용
 *
 * 이벤트 네이밍은 GA4-Data-Taxonomy.md 기준을 따른다.
 * 전송 흐름: 각 헬퍼 → sendGAEvent → GA4 MP endpoint (fetch)
 */

import { getOrCreateClientId } from "./clientId";
import { getStorage, setStorage } from "./chrome";
import { debugLog, warnLog, errorLog } from "@/utils/logger";

/** GA4 이벤트 파라미터 타입 — string, number, boolean만 허용 */
type GAEventParam = string | number | boolean;

const GA_ENDPOINT = "https://www.google-analytics.com/mp/collect";
const GA_DEBUG_ENDPOINT = "https://www.google-analytics.com/debug/mp/collect";
const MEASUREMENT_ID = "G-ECMY8N9FX4";

/** 빌드 시 .env에서 주입 */
const API_SECRET = import.meta.env.VITE_GA_API_SECRET;

/** 세션 타임아웃: 30분 */
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

/** 환경 구분: development(개발/로컬) / production(배포) */
const ENVIRONMENT = import.meta.env.VITE_ENVIRONMENT || "production";

/** development 환경에서만 debug endpoint + DebugView 활성화 */
const DEBUG_MODE = ENVIRONMENT === "development";

// ─── Session management ────────────────────────────────────────────────────

interface SessionResult {
  sessionId: string;
  /** 30분 타임아웃을 초과해 새 세션이 생성된 경우 true */
  isNewSession: boolean;
}

/**
 * Session ID 생성 및 관리
 *
 * 마지막 활동 기준 30분 이내면 기존 세션을 유지하고 타임스탬프를 갱신한다.
 * 30분 초과 또는 세션이 없으면 새 timestamp 기반 세션 ID를 생성한다.
 *
 * @returns sessionId와 새 세션 여부(isNewSession)를 함께 반환
 */
async function getOrCreateSessionId(): Promise<SessionResult> {
  try {
    const sessionId = await getStorage<string>("sessionId");
    const sessionTimestamp = await getStorage<number>("sessionTimestamp");
    const now = Date.now();

    if (sessionId && sessionTimestamp) {
      const timeSinceLastActivity = now - sessionTimestamp;
      if (timeSinceLastActivity < SESSION_TIMEOUT_MS) {
        await setStorage({ sessionTimestamp: now });
        return { sessionId, isNewSession: false };
      }
    }

    const newSessionId = now.toString();
    await setStorage({ sessionId: newSessionId, sessionTimestamp: now });

    if (DEBUG_MODE) {
      debugLog("[GA] New Session ID created:", newSessionId);
    }

    return { sessionId: newSessionId, isNewSession: true };
  } catch (error) {
    errorLog("[GA] Error getting/creating session ID:", error);
    return { sessionId: Date.now().toString(), isNewSession: false };
  }
}

// ─── Base sender ──────────────────────────────────────────────────────────

/**
 * Google Analytics 이벤트 전송 (내부 베이스 함수)
 *
 * 모든 도메인 헬퍼가 이 함수를 통해 GA4 MP로 이벤트를 전송한다.
 * API Secret이 없거나 fetch 실패 시 에러를 throw하지 않고 로그만 남긴다.
 *
 * @param eventName 이벤트 이름 (최대 40자, 영문/숫자/언더스코어)
 * @param eventParams 이벤트 파라미터 객체
 */
export async function sendGAEvent(
  eventName: string,
  eventParams: Record<string, GAEventParam> = {}
): Promise<void> {
  if (!API_SECRET) {
    warnLog("[GA] API Secret not configured. Event not sent:", eventName);
    return;
  }

  if (DEBUG_MODE) {
    debugLog("[GA] API Secret configured");
    debugLog("[GA] Environment:", ENVIRONMENT);
  }

  try {
    const clientId = await getOrCreateClientId();
    const { sessionId } = await getOrCreateSessionId();

    const payload = {
      client_id: clientId,
      events: [
        {
          name: eventName,
          params: {
            session_id: sessionId,
            engagement_time_msec: 100, // GA4 권장 최솟값
            ...(DEBUG_MODE && { debug_mode: 1 }), // DebugView 활성화
            ...eventParams,
          },
        },
      ],
    };

    const endpoint = DEBUG_MODE ? GA_DEBUG_ENDPOINT : GA_ENDPOINT;

    const response = await fetch(
      `${endpoint}?measurement_id=${MEASUREMENT_ID}&api_secret=${API_SECRET}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    if (DEBUG_MODE) {
      debugLog("[GA] Event sent:", eventName, eventParams);
      debugLog("[GA] Payload:", JSON.stringify(payload, null, 2));
      debugLog("[GA] Response status:", response.status, response.statusText);

      if (response.ok) {
        const debugResponse = await response.json();
        debugLog("[GA] Debug response:", debugResponse);
      } else {
        const errorText = await response.text();
        errorLog("[GA] Response error:", errorText);
      }
    }
  } catch (error) {
    errorLog("[GA] Error sending event:", error);
    if (DEBUG_MODE && error instanceof Error) {
      debugLog("[GA] Error details:", { message: error.message, stack: error.stack });
    }
  }
}

// ─── Lifecycle events ─────────────────────────────────────────────────────

/**
 * popup mount 시 호출하는 lifecycle 통합 함수
 *
 * 내부적으로 아래 3가지를 자동 처리한다:
 * 1. `firstOpenSent` 플래그가 없으면 `extension_first_open` 전송 후 플래그 저장
 * 2. 새 세션(30분 초과)이면 `extension_session_start` 전송
 * 3. 매번 `extension_open` 전송
 *
 * GA4 MP는 단일 요청에 이벤트 배열을 지원하므로 한 번의 fetch로 처리한다.
 *
 * @param screenName 현재 화면 식별자 (예: "popup_home")
 * @param entryPoint 진입 경로 (예: "popup")
 */
export async function sendExtensionOpen(
  screenName: string,
  entryPoint: string
): Promise<void> {
  if (!API_SECRET) {
    warnLog("[GA] API Secret not configured. Lifecycle events not sent.");
    return;
  }

  try {
    const clientId = await getOrCreateClientId();
    const { sessionId, isNewSession } = await getOrCreateSessionId();

    const baseParams: Record<string, GAEventParam> = {
      session_id: sessionId,
      engagement_time_msec: 100,
      screen_name: screenName,
      entry_point: entryPoint,
      ...(DEBUG_MODE && { debug_mode: 1 }),
    };

    const endpoint = DEBUG_MODE ? GA_DEBUG_ENDPOINT : GA_ENDPOINT;
    const url = `${endpoint}?measurement_id=${MEASUREMENT_ID}&api_secret=${API_SECRET}`;

    const events: { name: string; params: Record<string, GAEventParam> }[] = [];

    const firstOpenSent = await getStorage<boolean>("firstOpenSent");
    if (!firstOpenSent) {
      events.push({ name: "extension_first_open", params: baseParams });
      await setStorage({ firstOpenSent: true });
      if (DEBUG_MODE) debugLog("[GA] extension_first_open queued");
    }

    if (isNewSession) {
      events.push({ name: "extension_session_start", params: baseParams });
      if (DEBUG_MODE) debugLog("[GA] extension_session_start queued");
    }

    events.push({ name: "extension_open", params: baseParams });

    const payload = { client_id: clientId, events };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (DEBUG_MODE) {
      debugLog("[GA] Lifecycle events sent:", events.map((e) => e.name));
      debugLog("[GA] Response status:", response.status, response.statusText);
      if (response.ok) debugLog("[GA] Debug response:", await response.json());
    }
  } catch (error) {
    errorLog("[GA] Error sending lifecycle events:", error);
  }
}

// ─── Navigation ───────────────────────────────────────────────────────────

/**
 * 탭 전환 이벤트 전송
 * @param tabName 전환한 탭의 사용자 친화적 이름 (예: "링크모음", "공지사항")
 * @param featureArea 상위 기능 영역 (선택, 예: "links", "alerts")
 */
export async function sendNavigationTabSelect(
  tabName: string,
  featureArea?: string
): Promise<void> {
  await sendGAEvent("navigation_tab_select", {
    tab_name: tabName,
    ...(featureArea && { feature_area: featureArea }),
  });
}

// ─── Search ───────────────────────────────────────────────────────────────

/**
 * 검색 제출 이벤트 전송
 * @param searchTerm 입력한 검색어
 * @param searchLocation 검색 UI 위치 (선택, 예: "header")
 */
export async function sendSearchSubmit(
  searchTerm: string,
  searchLocation?: string
): Promise<void> {
  await sendGAEvent("search_submit", {
    search_term: searchTerm,
    ...(searchLocation && { search_location: searchLocation }),
  });
}

// ─── Link ─────────────────────────────────────────────────────────────────

/**
 * 링크 열기 이벤트 전송 — LinKU의 핵심 가치 행동을 측정한다
 * @param linkName 클릭한 링크 이름 (item.label 또는 same-host 버튼 조합 문자열)
 * @param linkUrl 링크 URL
 * @param linkGroup 링크가 속한 그룹명 (선택)
 * @param sameHostVariant same-host 버튼 구분자 (선택: "samehost_primary" | "samehost_secondary")
 */
export async function sendLinkOpen(
  linkName: string,
  linkUrl: string,
  linkGroup?: string,
  sameHostVariant?: string
): Promise<void> {
  await sendGAEvent("link_open", {
    link_name: linkName,
    link_url: linkUrl,
    ...(linkGroup && { link_group: linkGroup }),
    ...(sameHostVariant && { same_host_variant: sameHostVariant }),
  });
}

// ─── Auth ─────────────────────────────────────────────────────────────────

/**
 * 로그인 시작 이벤트 전송
 * @param provider 인증 제공자 (예: "google")
 * @param uiLocation 버튼이 위치한 UI (예: "settings_dialog")
 */
export async function sendAuthLoginStart(
  provider: string,
  uiLocation: string
): Promise<void> {
  await sendGAEvent("auth_login_start", {
    provider,
    ui_location: uiLocation,
  });
}

/**
 * 로그아웃 이벤트 전송
 * @param uiLocation 버튼이 위치한 UI (예: "settings_dialog")
 */
export async function sendAuthLogout(uiLocation: string): Promise<void> {
  await sendGAEvent("auth_logout", { ui_location: uiLocation });
}

// ─── Settings ─────────────────────────────────────────────────────────────

/** eCampus 인증정보 저장 완료 이벤트 전송 */
export async function sendSettingsCredentialsSaved(): Promise<void> {
  await sendGAEvent("settings_credentials_saved", { result: "success" });
}

/** eCampus 인증정보 삭제 완료 이벤트 전송 */
export async function sendSettingsCredentialsDeleted(): Promise<void> {
  await sendGAEvent("settings_credentials_deleted", { result: "success" });
}

// ─── System ───────────────────────────────────────────────────────────────

/**
 * 런타임 오류 이벤트 전송
 * @param errorCode 에러 식별 코드 (예: "network_error", "auth_required")
 * @param errorMessage 사람이 읽는 에러 설명
 * @param screenName 에러가 발생한 화면 (선택)
 */
export async function sendSystemError(
  errorCode: string,
  errorMessage: string,
  screenName?: string
): Promise<void> {
  await sendGAEvent("system_error", {
    error_code: errorCode,
    error_message: errorMessage,
    ...(screenName && { screen_name: screenName }),
  });
}

// ─── Generic button click ─────────────────────────────────────────────────

/**
 * 버튼 클릭 이벤트 전송
 *
 * taxonomy 관점에서 제품 의미가 큰 버튼은 개별 이벤트(sendAuthLoginStart 등)로 승격하고,
 * 당장 별도 이벤트가 없는 header 버튼 등 범용 클릭에만 사용한다.
 *
 * @param buttonName 버튼 식별 이름 (예: "settings_icon", "labs_icon")
 * @param buttonLocation 버튼이 위치한 UI (선택, 예: "header", "settings_dialog")
 */
export async function sendButtonClick(
  buttonName: string,
  buttonLocation?: string
): Promise<void> {
  await sendGAEvent("button_click", {
    button_name: buttonName,
    ...(buttonLocation && { button_location: buttonLocation }),
  });
}
