/**
 * Google Analytics 4 Measurement Protocol for Chrome Extension
 * Manifest V3 호환 — CSP 제약 없이 직접 fetch로 이벤트를 전송한다.
 *
 * ## 설계 원칙
 * 이벤트 네이밍과 파라미터는 GA4-Data-Taxonomy.md 기준을 따른다.
 * 모든 이벤트 정의는 이 파일 안에서만 이루어지며, 호출 지점(call site)은
 * 아래 도메인 헬퍼만 import해서 사용한다. sendGAEvent를 외부에서 직접
 * 호출하면 taxonomy 강제(naming enforcement)가 깨지므로 export하지 않는다.
 *
 * ## 도메인 헬퍼 목록
 * - Lifecycle  : sendExtensionOpen
 * - Navigation : sendNavigationTabSelect
 * - Search     : sendSearchSubmit
 * - Link       : sendLinkOpen
 * - Auth       : sendAuthLoginStart, sendAuthLoginSuccess, sendAuthLoginFail,
 *                sendAuthLogout, sendAuthEmailVerificationStart/Success
 * - Settings   : sendSettingsCredentialsSaved, sendSettingsCredentialsDeleted
 * - Template   : sendTemplateEditorOpen, sendTemplateItemAdd,
 *                sendTemplateSaveSuccess/Fail, sendTemplateSyncSuccess/Fail,
 *                sendTemplatePublishSuccess/Fail, sendTemplateApply
 * - Gallery    : sendTemplateGalleryOpen, sendTemplateGallerySearch,
 *                sendTemplateGallerySortChange, sendTemplateCloneSuccess/Fail,
 *                sendTemplateLikeToggle
 * - Alerts     : sendAlertsViewOpen, sendAlertsItemOpen
 * - Todo       : sendTodoViewOpen, sendTodoItemCreate,
 *                sendTodoItemComplete, sendTodoItemDelete
 * - Generic    : sendButtonClick (header 버튼 등 별도 이벤트가 없는 범용 클릭)
 *
 * ## 전송 흐름
 * 각 헬퍼 → sendGAEvent (internal) → GA4 MP endpoint (fetch)
 */

import { getOrCreateClientId } from "./clientId";
import { getStorage, setStorage } from "./chrome";
import { debugLog, warnLog, errorLog } from "@/utils/logger";

/** GA4 이벤트 파라미터 타입 — string, number, boolean만 허용 */
type GAEventParam = string | number | boolean;

const GA_ENDPOINT = "https://www.google-analytics.com/mp/collect";
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

    // 세션이 존재하고 30분 이내라면 타임스탬프만 갱신해 세션 유지
    if (sessionId && sessionTimestamp) {
      const timeSinceLastActivity = now - sessionTimestamp;
      if (timeSinceLastActivity < SESSION_TIMEOUT_MS) {
        await setStorage({ sessionTimestamp: now });
        return { sessionId, isNewSession: false };
      }
    }

    // 세션 없음 또는 타임아웃 → 새 세션 생성
    const newSessionId = now.toString();
    await setStorage({ sessionId: newSessionId, sessionTimestamp: now });

    if (DEBUG_MODE) {
      debugLog("[GA] New Session ID created:", newSessionId);
    }

    return { sessionId: newSessionId, isNewSession: true };
  } catch (error) {
    // storage 접근 실패 시 fallback — 이 세션은 저장되지 않아 다음 호출에서도 새 세션으로 취급됨
    errorLog("[GA] Error getting/creating session ID:", error);
    return { sessionId: Date.now().toString(), isNewSession: false };
  }
}

// ─── Base sender ──────────────────────────────────────────────────────────

/**
 * GA4 MP 이벤트 전송 — 모든 도메인 헬퍼의 내부 베이스 함수
 *
 * 이 함수는 파일 외부에 export되지 않는다. 호출 지점에서는 도메인 헬퍼만 사용할 것.
 * API Secret이 없거나 fetch 실패 시 에러를 throw하지 않고 로그만 남긴다.
 *
 * @param eventName 이벤트 이름 (최대 40자, 영문/숫자/언더스코어)
 * @param eventParams 이벤트 파라미터 객체
 */
async function sendGAEvent(
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
            engagement_time_msec: 100, // GA4 세션 참여도 집계를 위한 권장 최솟값
            ...(DEBUG_MODE && { debug_mode: 1 }), // GA4 DebugView에서 실시간 확인용
            ...eventParams,
          },
        },
      ],
    };

    const response = await fetch(
      `${GA_ENDPOINT}?measurement_id=${MEASUREMENT_ID}&api_secret=${API_SECRET}`,
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

      // debug endpoint는 응답 본문에 검증 결과를 포함하므로 파싱해서 출력
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

    // 모든 lifecycle 이벤트에 공통으로 붙는 파라미터
    const baseParams: Record<string, GAEventParam> = {
      session_id: sessionId,
      engagement_time_msec: 100,
      screen_name: screenName,
      entry_point: entryPoint,
      ...(DEBUG_MODE && { debug_mode: 1 }),
    };

    const url = `${GA_ENDPOINT}?measurement_id=${MEASUREMENT_ID}&api_secret=${API_SECRET}`;

    // 전송할 이벤트를 조건에 따라 배열로 누적 — GA4 MP는 단일 요청에 이벤트 배열 지원
    const events: { name: string; params: Record<string, GAEventParam> }[] = [];

    // 기기 최초 설치 후 첫 실행에만 1회 전송 (chrome.storage에 플래그 영구 저장)
    const firstOpenSent = await getStorage<boolean>("firstOpenSent");
    if (!firstOpenSent) {
      events.push({ name: "extension_first_open", params: baseParams });
      await setStorage({ firstOpenSent: true });
      if (DEBUG_MODE) debugLog("[GA] extension_first_open queued");
    }

    // 30분 비활동 후 새 세션이 생성된 경우에만 전송
    if (isNewSession) {
      events.push({ name: "extension_session_start", params: baseParams });
      if (DEBUG_MODE) debugLog("[GA] extension_session_start queued");
    }

    // 팝업 열릴 때마다 항상 전송
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
 * 제품 의미가 큰 버튼은 개별 이벤트(sendAuthLoginStart 등)로 승격하고,
 * 별도 이벤트가 없는 header 버튼 등 범용 클릭에만 사용한다.
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

/**
 * 로그인 성공 이벤트 전송
 * @param provider 인증 제공자 (예: "google")
 * @param isGuest 게스트 계정 여부
 */
export async function sendAuthLoginSuccess(
  provider: string,
  isGuest: boolean
): Promise<void> {
  await sendGAEvent("auth_login_success", {
    provider,
    is_guest: isGuest,
  });
}

/**
 * 로그인 실패 이벤트 전송
 * @param provider 인증 제공자 (예: "google")
 * @param errorCode 에러 식별 코드
 * @param errorMessage 사람이 읽는 에러 설명
 */
export async function sendAuthLoginFail(
  provider: string,
  errorCode: string,
  errorMessage: string
): Promise<void> {
  await sendGAEvent("auth_login_fail", {
    provider,
    error_code: errorCode,
    error_message: errorMessage,
  });
}

/**
 * 이메일 인증 시작 이벤트 전송 (게스트 → 정회원 전환 시작)
 * @param uiLocation 버튼이 위치한 UI (예: "settings_dialog")
 */
export async function sendAuthEmailVerificationStart(
  uiLocation: string
): Promise<void> {
  await sendGAEvent("auth_email_verification_start", {
    ui_location: uiLocation,
  });
}

/**
 * 이메일 인증 완료 이벤트 전송 (게스트 → 정회원 전환 완료)
 * @param domainType 인증된 이메일 도메인 유형 (예: "konkuk.ac.kr")
 */
export async function sendAuthEmailVerificationSuccess(
  domainType: string
): Promise<void> {
  await sendGAEvent("auth_email_verification_success", { domain_type: domainType });
}

// ─── Template ─────────────────────────────────────────────────────────────

/**
 * 템플릿 에디터 진입 이벤트 전송
 * @param templateOrigin 템플릿 출처 ("default" | "owned" | "cloned" | "posted" | "local_only")
 * @param templateId 템플릿 식별자 (선택)
 */
export async function sendTemplateEditorOpen(
  templateOrigin: string,
  templateId?: number
): Promise<void> {
  await sendGAEvent("template_editor_open", {
    template_origin: templateOrigin,
    ...(templateId !== undefined && { template_id: templateId }),
  });
}

/**
 * 템플릿 아이템 추가 이벤트 전송
 * @param addMethod 추가 방식 (예: "drag", "button")
 * @param templateId 템플릿 식별자 (선택)
 */
export async function sendTemplateItemAdd(
  addMethod: string,
  templateId?: number
): Promise<void> {
  await sendGAEvent("template_item_add", {
    add_method: addMethod,
    ...(templateId !== undefined && { template_id: templateId }),
  });
}

/**
 * 템플릿 로컬 저장 성공 이벤트 전송
 * @param templateId 템플릿 식별자
 * @param templateOrigin 템플릿 출처
 * @param itemCount 저장된 아이템 수
 */
export async function sendTemplateSaveSuccess(
  templateId: number,
  templateOrigin: string,
  itemCount: number
): Promise<void> {
  await sendGAEvent("template_save_success", {
    template_id: templateId,
    template_origin: templateOrigin,
    item_count: itemCount,
  });
}

/**
 * 템플릿 로컬 저장 실패 이벤트 전송
 * @param templateId 템플릿 식별자
 * @param errorCode 에러 식별 코드
 * @param errorMessage 사람이 읽는 에러 설명
 */
export async function sendTemplateSaveFail(
  templateId: number,
  errorCode: string,
  errorMessage: string
): Promise<void> {
  await sendGAEvent("template_save_fail", {
    template_id: templateId,
    error_code: errorCode,
    error_message: errorMessage,
  });
}

/**
 * 템플릿 서버 동기화 성공 이벤트 전송
 * @param templateId 템플릿 식별자
 * @param itemCount 동기화된 아이템 수
 */
export async function sendTemplateSyncSuccess(
  templateId: number,
  itemCount: number
): Promise<void> {
  await sendGAEvent("template_sync_success", {
    template_id: templateId,
    item_count: itemCount,
  });
}

/**
 * 템플릿 서버 동기화 실패 이벤트 전송
 * @param templateId 템플릿 식별자
 * @param errorCode 에러 식별 코드
 * @param errorMessage 사람이 읽는 에러 설명
 */
export async function sendTemplateSyncFail(
  templateId: number,
  errorCode: string,
  errorMessage: string
): Promise<void> {
  await sendGAEvent("template_sync_fail", {
    template_id: templateId,
    error_code: errorCode,
    error_message: errorMessage,
  });
}

/**
 * 템플릿 갤러리 게시 성공 이벤트 전송
 * @param templateId 템플릿 식별자
 * @param itemCount 게시된 아이템 수
 */
export async function sendTemplatePublishSuccess(
  templateId: number,
  itemCount: number
): Promise<void> {
  await sendGAEvent("template_publish_success", {
    template_id: templateId,
    item_count: itemCount,
  });
}

/**
 * 템플릿 갤러리 게시 실패 이벤트 전송
 * @param templateId 템플릿 식별자
 * @param errorCode 에러 식별 코드
 * @param errorMessage 사람이 읽는 에러 설명
 */
export async function sendTemplatePublishFail(
  templateId: number,
  errorCode: string,
  errorMessage: string
): Promise<void> {
  await sendGAEvent("template_publish_fail", {
    template_id: templateId,
    error_code: errorCode,
    error_message: errorMessage,
  });
}

/**
 * 템플릿 메인 화면 적용 이벤트 전송 — 핵심 가치 행동
 * @param templateId 템플릿 식별자
 * @param templateOrigin 템플릿 출처
 * @param isDefault 기본 템플릿 여부
 */
export async function sendTemplateApply(
  templateId: number,
  templateOrigin: string,
  isDefault: boolean
): Promise<void> {
  await sendGAEvent("template_apply", {
    template_id: templateId,
    template_origin: templateOrigin,
    is_default: isDefault,
  });
}

// ─── Template Gallery ──────────────────────────────────────────────────────

/**
 * 템플릿 갤러리 진입 이벤트 전송
 * @param entryPoint 진입 경로 (예: "settings_dialog", "popup")
 */
export async function sendTemplateGalleryOpen(entryPoint: string): Promise<void> {
  await sendGAEvent("template_gallery_open", { entry_point: entryPoint });
}

/**
 * 갤러리 검색 이벤트 전송
 * @param queryLength 검색어 길이
 * @param sortOption 현재 정렬 옵션
 */
export async function sendTemplateGallerySearch(
  queryLength: number,
  sortOption: string
): Promise<void> {
  await sendGAEvent("template_gallery_search", {
    query_length: queryLength,
    sort_option: sortOption,
  });
}

/**
 * 갤러리 정렬 변경 이벤트 전송
 * @param sortOption 선택한 정렬 옵션
 */
export async function sendTemplateGallerySortChange(sortOption: string): Promise<void> {
  await sendGAEvent("template_gallery_sort_change", { sort_option: sortOption });
}

/**
 * 갤러리 템플릿 복제 성공 이벤트 전송
 * @param postedTemplateId 게시된 템플릿 식별자
 * @param authorIdPresent 작성자 ID 포함 여부
 */
export async function sendTemplateCloneSuccess(
  postedTemplateId: number,
  authorIdPresent: boolean
): Promise<void> {
  await sendGAEvent("template_clone_success", {
    posted_template_id: postedTemplateId,
    author_id_present: authorIdPresent,
  });
}

/**
 * 갤러리 템플릿 복제 실패 이벤트 전송
 * @param postedTemplateId 게시된 템플릿 식별자
 * @param errorCode 에러 식별 코드
 * @param errorMessage 사람이 읽는 에러 설명 (선택)
 */
export async function sendTemplateCloneFail(
  postedTemplateId: number,
  errorCode: string,
  errorMessage?: string
): Promise<void> {
  await sendGAEvent("template_clone_fail", {
    posted_template_id: postedTemplateId,
    error_code: errorCode,
    ...(errorMessage && { error_message: errorMessage }),
  });
}

/**
 * 좋아요 토글 이벤트 전송
 * @param postedTemplateId 게시된 템플릿 식별자
 * @param liked 좋아요 여부 (true: 좋아요, false: 취소)
 */
export async function sendTemplateLikeToggle(
  postedTemplateId: number,
  liked: boolean
): Promise<void> {
  await sendGAEvent("template_like_toggle", {
    posted_template_id: postedTemplateId,
    liked,
  });
}

// ─── Alerts ───────────────────────────────────────────────────────────────

/**
 * 공지사항 탭 진입 이벤트 전송
 * @param viewMode 현재 보기 모드 (예: "all", "my")
 * @param category 선택된 카테고리
 */
export async function sendAlertsViewOpen(
  viewMode: string,
  category: string
): Promise<void> {
  await sendGAEvent("alerts_view_open", { view_mode: viewMode, category });
}

/**
 * 공지사항 아이템 클릭 이벤트 전송
 * @param alertId 공지 식별자
 * @param category 공지 카테고리
 * @param source 공지 출처 (예: "konkuk", "ecampus")
 */
export async function sendAlertsItemOpen(
  alertId: string | number,
  category: string,
  source: string
): Promise<void> {
  await sendGAEvent("alerts_item_open", {
    alert_id: String(alertId),
    category,
    source,
  });
}

// ─── Todo ─────────────────────────────────────────────────────────────────

/**
 * Todo 탭 진입 이벤트 전송
 * @param todoCount 현재 Todo 아이템 수
 */
export async function sendTodoViewOpen(todoCount: number): Promise<void> {
  await sendGAEvent("todo_view_open", { todo_count: todoCount });
}

/**
 * Todo 아이템 생성 이벤트 전송
 * @param source 생성 경로 (예: "dialog")
 * @param hasDueDate 마감일 설정 여부
 */
export async function sendTodoItemCreate(
  source: string,
  hasDueDate: boolean
): Promise<void> {
  await sendGAEvent("todo_item_create", { source, has_due_date: hasDueDate });
}

/**
 * Todo 아이템 완료 토글 이벤트 전송
 * @param itemType Todo 유형 (예: "custom", "ecampus")
 */
export async function sendTodoItemComplete(itemType: string): Promise<void> {
  await sendGAEvent("todo_item_complete", { item_type: itemType });
}

/**
 * Todo 아이템 삭제 이벤트 전송
 * @param itemType Todo 유형 (예: "custom", "ecampus")
 */
export async function sendTodoItemDelete(itemType: string): Promise<void> {
  await sendGAEvent("todo_item_delete", { item_type: itemType });
}
