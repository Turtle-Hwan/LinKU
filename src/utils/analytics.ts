/**
 * Google Analytics 4 Measurement Protocol for Chrome Extension
 * Manifest V3 호환 — popup에서 만든 batch를 background worker가 전송한다.
 *
 * ## 이벤트 분류
 *
 * ### 레거시 이벤트 (v1.5.46 이전부터 수집, 연속성 유지)
 * - page_view     : sendPageView
 * - link_click    : sendLinkClick
 * - tab_change    : sendTabChange
 * - button_click  : sendButtonClick
 * - setting_change: sendSettingChange (settings_credentials_saved/deleted 내부에서 병렬 발송)
 * - error         : sendError
 *
 * ### 도메인 이벤트 (기존 `MP_` 이름은 연속성 유지)
 * - Lifecycle  : sendExtensionOpen
 * - Search     : sendSearchSubmit
 * - Auth       : sendAuthLoginStart, sendAuthLoginSuccess, sendAuthLoginFail,
 *                sendAuthLogout, sendAuthEmailVerificationStart/Success
 * - Settings   : sendSettingsOpen, sendSettingsCredentialsSaved, sendSettingsCredentialsDeleted
 * - System     : sendError
 * - Template   : sendTemplateEditorView, sendTemplateCreateStart,
 *                sendTemplateItemAdd, sendTemplateItemUpdate, sendTemplateItemDelete,
 *                sendTemplateSaveSuccess/Fail, sendTemplateApply, sendTemplateDelete
 * - Banner     : sendBannerOpen
 * - Alerts     : sendAlertsView, sendAlertsItemOpen, sendAlertsSubscriptionChange
 * - Todo       : sendTodoView, sendTodoItemCreate, sendTodoItemComplete, sendTodoItemDelete
 * - Labs       : sendLabsOpen, sendLabsFeatureUse
 * - Navigation : sendNavigationTabView
 * - Generic    : sendButtonClick (별도 이벤트 없는 범용 클릭)
 *
 * ## 설계 원칙
 * - sendGAEvent는 외부에 export하지 않는다. 호출 지점은 도메인 헬퍼만 import할 것
 * - 기존 MP_ 이벤트명은 연속성을 위해 유지하고 새 이벤트는 lower_snake_case를 사용한다
 * - 이벤트 네이밍과 파라미터 패턴: docs/GA4-Data-Taxonomy.md 기준을 따른다
 *
 * ## 전송 흐름
 * 각 헬퍼 → sendGAEvent (internal) → background worker → GA4/proxy
 */

import { getOrCreateClientId } from "./clientId";
import { getStorage, isExtensionEnvironment, setStorage } from "./chrome";
import { BackgroundMessageType } from "@/background/types";
import type { AnalyticsTransportResponse } from "@/background/types";
import {
  isAnalyticsPayload,
  type AnalyticsPayload,
  type GAEvent,
  type GAEventParam,
} from "@/utils/analyticsContract";
import {
  debugLog,
  errorLog,
  getErrorLogDetails,
  warnLogOnly,
} from "@/utils/logger";
import { recordBreadcrumb } from "@/monitoring";

/** 세션 타임아웃: 30분 */
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

/** 환경 구분: development(개발/로컬) / production(배포) */
const ENVIRONMENT = import.meta.env.VITE_ENVIRONMENT || "production";

/** development 환경에서만 DebugView parameter 활성화 */
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

async function dispatchAnalyticsPayload(
  payload: unknown,
): Promise<boolean> {
  if (!isAnalyticsPayload(payload)) {
    recordBreadcrumb(
      "analytics.dispatch",
      "invalid analytics payload skipped",
      {},
      "warning",
    );
    warnLogOnly("[GA] Invalid analytics payload skipped");
    return false;
  }

  try {
    const response = (await chrome.runtime.sendMessage({
      type: BackgroundMessageType.ANALYTICS_BATCH,
      data: { payload },
    })) as AnalyticsTransportResponse | undefined;

    if (!response || typeof response.success !== "boolean") {
      recordBreadcrumb(
        "analytics.dispatch",
        "analytics background response missing",
        { event_count: payload.events.length },
        "warning",
      );
      warnLogOnly("[GA] Background response missing", {
        eventCount: payload.events.length,
      });
      return false;
    }

    return response.success;
  } catch (error) {
    recordBreadcrumb(
      "analytics.dispatch",
      "analytics background dispatch failed",
      { error: getErrorLogDetails(error) },
      "warning",
    );
    warnLogOnly(
      "[GA] Background dispatch failed",
      getErrorLogDetails(error),
    );
    return false;
  }
}

/**
 * GA4 MP 이벤트 전송 — 모든 도메인 헬퍼의 내부 베이스 함수
 *
 * 이 함수는 파일 외부에 export되지 않는다. 호출 지점에서는 도메인 헬퍼만 사용할 것.
 * transport가 준비되지 않았거나 전송이 실패해도 제품 동작에는 에러를 throw하지 않는다.
 *
 * @param eventName 이벤트 이름 (최대 40자, 영문/숫자/언더스코어)
 * @param eventParams 이벤트 파라미터 객체
 */
async function sendGAEvent(
  eventName: string,
  eventParams: Record<string, GAEventParam> = {}
): Promise<void> {
  if (!isExtensionEnvironment()) {
    if (DEBUG_MODE) {
      debugLog("[GA] Skipping event outside extension context:", eventName);
    }
    return;
  }

  try {
    const clientId = await getOrCreateClientId();
    const { sessionId } = await getOrCreateSessionId();

    const payload: AnalyticsPayload = {
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

    const delivered = await dispatchAnalyticsPayload(payload);

    if (DEBUG_MODE && delivered) {
      debugLog("[GA] Event sent:", eventName, eventParams);
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
 * GA4 MP는 단일 요청에 이벤트 배열을 지원하므로 한 batch로 처리한다.
 *
 * @param screenName 현재 화면 식별자 (예: "popup_home")
 * @param entryPoint 진입 경로 (예: "popup")
 */
export async function sendExtensionOpen(
  screenName: string,
  entryPoint: string
): Promise<void> {
  if (!isExtensionEnvironment()) {
    if (DEBUG_MODE) {
      debugLog("[GA] Skipping lifecycle events outside extension context.");
    }
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

    // 전송할 이벤트를 조건에 따라 배열로 누적 — GA4 MP는 단일 요청에 이벤트 배열 지원
    const events: GAEvent[] = [];

    // 기기 최초 설치 후 첫 실행에만 1회 전송 (전송 성공 후 chrome.storage에 플래그 저장)
    const firstOpenSent = await getStorage<boolean>("firstOpenSent");
    const shouldMarkFirstOpenSent = !firstOpenSent;
    if (!firstOpenSent) {
      events.push({ name: "extension_first_open", params: baseParams });
      if (DEBUG_MODE) debugLog("[GA] extension_first_open queued");
    }

    // 30분 비활동 후 새 세션이 생성된 경우에만 전송
    if (isNewSession) {
      events.push({ name: "extension_session_start", params: baseParams });
      if (DEBUG_MODE) debugLog("[GA] extension_session_start queued");
    }

    // 팝업 열릴 때마다 항상 전송
    events.push({ name: "extension_open", params: baseParams });

    const payload: AnalyticsPayload = { client_id: clientId, events };
    const delivered = await dispatchAnalyticsPayload(payload);

    if (shouldMarkFirstOpenSent && delivered) {
      await setStorage({ firstOpenSent: true });
    }

    if (DEBUG_MODE && delivered) {
      debugLog("[GA] Lifecycle events sent:", events.map((e) => e.name));
    }
  } catch (error) {
    errorLog("[GA] Error sending lifecycle events:", error);
  }
}

// ─── Legacy events (v1.5.46 이전 수집 — 연속성 유지) ──────────────────────

/**
 * 페이지뷰 이벤트 전송 (레거시)
 *
 * popup 진입 시 sendExtensionOpen과 함께 호출한다.
 * @param pageTitle 페이지 제목
 * @param pageLocation 페이지 경로 (선택)
 */
export async function sendPageView(
  pageTitle: string,
  pageLocation?: string
): Promise<void> {
  await sendGAEvent("page_view", {
    page_title: pageTitle,
    page_location: pageLocation || "chrome-extension://linku/popup",
    page_referrer: document.referrer || "direct",
  });
}

/**
 * 링크 클릭 이벤트 전송 (레거시) — LinKU의 핵심 가치 행동을 측정한다
 * @param linkName 클릭한 링크 이름 (item.label 또는 same-host 버튼 조합 문자열)
 * @param linkUrl 링크 URL
 * @param linkGroup 링크가 속한 그룹명 (선택)
 * @param sameHostVariant same-host 버튼 구분자 (선택: "samehost_primary" | "samehost_secondary")
 */
export async function sendLinkClick(
  linkName: string,
  linkUrl: string,
  linkGroup?: string,
  sameHostVariant?: string
): Promise<void> {
  await sendGAEvent("link_click", {
    link_name: linkName,
    link_url: linkUrl,
    ...(linkGroup && { link_group: linkGroup }),
    ...(sameHostVariant && { same_host_variant: sameHostVariant }),
  });
}

/**
 * 탭 전환 이벤트 전송 (레거시)
 * @param tabName 전환한 탭의 사용자 친화적 이름 (예: "링크모음", "공지사항")
 * @param featureArea 상위 기능 영역 (선택, 예: "links", "alerts")
 */
export async function sendTabChange(
  tabName: string,
  featureArea?: string
): Promise<void> {
  await sendGAEvent("tab_change", {
    tab_name: tabName,
    ...(featureArea && { feature_area: featureArea }),
  });
}

export type NavigationTabFeatureArea = "labs" | "settings";
export type NavigationTabViewSource =
  | "default"
  | "restored"
  | "user_select";

/** 다이얼로그 탭이 실제로 표시될 때 전송하는 진입 이벤트 */
export async function sendNavigationTabView(
  featureArea: NavigationTabFeatureArea,
  tabName: string,
  viewSource: NavigationTabViewSource,
): Promise<void> {
  await sendGAEvent("navigation_tab_view", {
    feature_area: featureArea,
    tab_name: tabName,
    ui_location: "dialog",
    view_source: viewSource,
  });
}

/**
 * 버튼 클릭 이벤트 전송 (레거시)
 *
 * 제품 의미가 큰 버튼은 개별 MP_ 이벤트로 승격하고,
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

export async function sendSettingChange(
  settingName: string,
  settingValue: string,
): Promise<void> {
  await sendGAEvent("setting_change", {
    setting_name: settingName,
    setting_value: settingValue,
  });
}

/**
 * 런타임 오류 이벤트 전송 (레거시)
 * @param errorCode 에러 식별 코드 (예: "network_error", "auth_required")
 * @param errorMessage 사람이 읽는 에러 설명
 * @param screenName 에러가 발생한 화면 (선택)
 */
export async function sendError(
  errorCode: string,
  errorMessage: string,
  screenName?: string
): Promise<void> {
  await sendGAEvent("error", {
    error_code: errorCode,
    error_message: errorMessage,
    ...(screenName && { screen_name: screenName }),
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
  await sendGAEvent("MP_search_submit", {
    search_term: searchTerm,
    ...(searchLocation && { search_location: searchLocation }),
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
  await sendGAEvent("MP_authLogin_start", {
    provider,
    ui_location: uiLocation,
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
  await sendGAEvent("MP_authLogin_success", {
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
  await sendGAEvent("MP_authLogin_fail", {
    provider,
    error_code: errorCode,
    error_message: errorMessage,
  });
}

/**
 * 로그아웃 이벤트 전송
 * @param uiLocation 버튼이 위치한 UI (예: "settings_dialog")
 */
export async function sendAuthLogout(uiLocation: string): Promise<void> {
  await sendGAEvent("MP_auth_logout", { ui_location: uiLocation });
}

/**
 * 이메일 인증 시작 이벤트 전송 (게스트 → 정회원 전환 시작)
 * @param uiLocation 버튼이 위치한 UI (예: "settings_dialog")
 */
export async function sendAuthEmailVerificationStart(
  uiLocation: string
): Promise<void> {
  await sendGAEvent("MP_authEmailVerification_start", {
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
  await sendGAEvent("MP_authEmailVerification_success", { domain_type: domainType });
}

// ─── Settings ─────────────────────────────────────────────────────────────

/**
 * 설정 다이얼로그 진입 이벤트 전송
 * @param entryPoint 진입 경로 (예: "header")
 */
export async function sendSettingsOpen(entryPoint: string): Promise<void> {
  await sendGAEvent("MP_settings_open", { entry_point: entryPoint });
}

/**
 * eCampus 인증정보 저장 완료 이벤트 전송
 *
 * 레거시 연속성을 위해 `setting_change`와 신규 `MP_settingsCredentials_save`를 병렬 전송한다.
 */
export async function sendSettingsCredentialsSaved(): Promise<void> {
  // 레거시 이벤트 — v1.5.46 이전 데이터와의 연속성 유지
  await sendGAEvent("setting_change", { setting_name: "credentials", setting_value: "saved" });
  // 신규 이벤트
  await sendGAEvent("MP_settingsCredentials_save", { result: "success" });
}

/**
 * eCampus 인증정보 삭제 완료 이벤트 전송
 *
 * 레거시 연속성을 위해 `setting_change`와 신규 `MP_settingsCredentials_delete`를 병렬 전송한다.
 */
export async function sendSettingsCredentialsDeleted(): Promise<void> {
  // 레거시 이벤트 — v1.5.46 이전 데이터와의 연속성 유지
  await sendGAEvent("setting_change", { setting_name: "credentials", setting_value: "deleted" });
  // 신규 이벤트
  await sendGAEvent("MP_settingsCredentials_delete", { result: "success" });
}

// ─── Template ─────────────────────────────────────────────────────────────

/**
 * 템플릿 에디터 진입 이벤트 전송
 * @param templateOrigin 템플릿 출처 ("default" | "owned" | "cloned" | "posted" | "local_only")
 * @param templateId 템플릿 식별자 (선택)
 */
export async function sendTemplateEditorView(
  templateOrigin: string,
  templateId?: number
): Promise<void> {
  await sendGAEvent("MP_templateEditor_view", {
    template_origin: templateOrigin,
    ...(templateId !== undefined && { template_id: templateId }),
  });
}

/**
 * 새 템플릿 만들기 진입 이벤트 전송
 * @param templateOrigin 생성 출처 ("default" | "empty")
 */
export async function sendTemplateCreateStart(templateOrigin: string): Promise<void> {
  await sendGAEvent("MP_template_createStart", { template_origin: templateOrigin });
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
  await sendGAEvent("MP_templateItem_add", {
    add_method: addMethod,
    ...(templateId !== undefined && { template_id: templateId }),
  });
}

/**
 * 템플릿 아이템 속성 저장 이벤트 전송
 * @param updateType 업데이트 유형 (예: "properties")
 * @param templateId 템플릿 식별자 (선택)
 */
export async function sendTemplateItemUpdate(
  updateType: string,
  templateId?: number
): Promise<void> {
  await sendGAEvent("MP_templateItem_update", {
    update_type: updateType,
    ...(templateId !== undefined && { template_id: templateId }),
  });
}

/**
 * 템플릿 아이템 삭제 이벤트 전송
 * @param deleteSource 삭제 경로 ("canvas" = 임시저장으로 이동, "staging" = 영구 삭제)
 * @param templateId 템플릿 식별자 (선택)
 */
export async function sendTemplateItemDelete(
  deleteSource: string,
  templateId?: number
): Promise<void> {
  await sendGAEvent("MP_templateItem_delete", {
    delete_source: deleteSource,
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
  await sendGAEvent("MP_templateSave_success", {
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
  await sendGAEvent("MP_templateSave_fail", {
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
  await sendGAEvent("MP_template_apply", {
    template_id: templateId,
    template_origin: templateOrigin,
    is_default: isDefault,
  });
}

/**
 * 템플릿 삭제 이벤트 전송
 * @param templateId 템플릿 식별자
 * @param templateOrigin 템플릿 출처 ("owned" | "cloned")
 * @param syncStatus 동기화 상태 ("local" | "synced")
 */
export async function sendTemplateDelete(
  templateId: number,
  templateOrigin: string,
  syncStatus: string
): Promise<void> {
  await sendGAEvent("MP_template_delete", {
    template_id: templateId,
    template_origin: templateOrigin,
    sync_status: syncStatus,
  });
}

// ─── Alerts ───────────────────────────────────────────────────────────────

/**
 * 공지사항 탭 진입 이벤트 전송
 * @param viewMode 현재 보기 모드 (예: "all", "my")
 * @param category 선택된 카테고리
 */
export async function sendAlertsView(
  viewMode: string,
  category: string
): Promise<void> {
  await sendGAEvent("MP_alerts_view", { view_mode: viewMode, category });
}

/**
 * 배너 클릭 이벤트 전송
 * @param bannerId 배너 식별자 (이미지 파일명)
 * @param bannerTitle 배너 제목 (alt 텍스트)
 * @param bannerPosition 배너 위치 (슬라이드 인덱스, 0-based)
 */
export async function sendBannerOpen(
  bannerId: string,
  bannerTitle: string,
  bannerPosition: number
): Promise<void> {
  await sendGAEvent("MP_banner_open", {
    banner_id: bannerId,
    banner_title: bannerTitle,
    banner_position: bannerPosition,
  });
}

/**
 * 공지사항 아이템 클릭 이벤트 전송
 * @param alertId 공지 식별자
 * @param category 공지 카테고리
 * @param source 공지 출처 ("general" | "department")
 */
export async function sendAlertsItemOpen(
  alertId: string | number,
  category: string,
  source: string
): Promise<void> {
  await sendGAEvent("MP_alertsItem_open", {
    alert_id: String(alertId),
    category,
    source,
  });
}

/**
 * 학과 구독 변경 이벤트 전송
 * @param category 구독 변경된 학과명
 * @param subscriptionResult 변경 결과 ("subscribe" | "unsubscribe")
 */
export async function sendAlertsSubscriptionChange(
  category: string,
  subscriptionResult: string
): Promise<void> {
  await sendGAEvent("MP_alertsSubscription_update", {
    category,
    subscription_result: subscriptionResult,
  });
}

// ─── Todo ─────────────────────────────────────────────────────────────────

/**
 * Todo 탭 진입 이벤트 전송
 * @param todoCount 현재 Todo 아이템 수
 */
export async function sendTodoView(todoCount: number): Promise<void> {
  await sendGAEvent("MP_todo_view", { todo_count: todoCount });
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
  await sendGAEvent("MP_todoItem_create", { source, has_due_date: hasDueDate });
}

/**
 * Todo 아이템 완료 토글 이벤트 전송
 * @param itemType Todo 유형 (예: "custom", "ecampus")
 */
export async function sendTodoItemComplete(itemType: string): Promise<void> {
  await sendGAEvent("MP_todoItem_complete", { item_type: itemType });
}

/**
 * Todo 아이템 삭제 이벤트 전송
 * @param itemType Todo 유형 (예: "custom", "ecampus")
 */
export async function sendTodoItemDelete(itemType: string): Promise<void> {
  await sendGAEvent("MP_todoItem_delete", { item_type: itemType });
}

// ─── Labs ─────────────────────────────────────────────────────────────────

/** Labs 다이얼로그 진입 이벤트 전송 */
export async function sendLabsOpen(): Promise<void> {
  await sendGAEvent("MP_labs_open", {});
}

/**
 * Labs 개별 기능 사용 이벤트 전송
 * @param featureName 사용한 기능 식별자 (예: "qr_generator", "library_seat")
 * @param result 결과 (선택, 예: "success", "fail")
 */
export async function sendLabsFeatureUse(
  featureName: string,
  result?: string
): Promise<void> {
  await sendGAEvent("MP_labsFeature_use", {
    feature_name: featureName,
    ...(result && { result }),
  });
}
