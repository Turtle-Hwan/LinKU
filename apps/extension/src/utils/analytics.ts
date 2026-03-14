/**
 * Google Analytics 4 Measurement Protocol for Chrome Extension
 * Manifest V3 호환 - CSP 제약 없이 Analytics 사용
 */

import { getOrCreateClientId } from "./clientId";
import { getStorage, setStorage } from "./chrome";

// GA4 이벤트 파라미터 타입 (string, number, boolean만 허용)
type GAEventParam = string | number | boolean;

const GA_ENDPOINT = "https://www.google-analytics.com/mp/collect";
const GA_DEBUG_ENDPOINT = "https://www.google-analytics.com/debug/mp/collect";
const MEASUREMENT_ID = "G-ECMY8N9FX4";

// 환경변수에서 API Secret 가져오기
// 빌드 시 .env에서 주입됨
const API_SECRET = import.meta.env.VITE_GA_API_SECRET;

// 세션 타임아웃: 30분
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

// 환경 구분: development (개발/로컬 빌드) / production (배포)
const ENVIRONMENT = import.meta.env.VITE_ENVIRONMENT || "production";

// 디버그 모드 (development 환경에서만 활성화)
const DEBUG_MODE = ENVIRONMENT === "development";

/**
 * Session ID 생성 및 관리
 * 30분 동안 활동이 없으면 새 세션 시작
 */
async function getOrCreateSessionId(): Promise<string> {
  try {
    const sessionId = await getStorage<string>("sessionId");
    const sessionTimestamp = await getStorage<number>("sessionTimestamp");
    const now = Date.now();

    if (sessionId && sessionTimestamp) {
      const timeSinceLastActivity = now - sessionTimestamp;

      if (timeSinceLastActivity < SESSION_TIMEOUT_MS) {
        // 세션 유지, 타임스탬프 업데이트
        await setStorage({ sessionTimestamp: now });
        return sessionId;
      }
    }

    // 새 세션 생성 (timestamp 사용)
    const newSessionId = now.toString();
    await setStorage({
      sessionId: newSessionId,
      sessionTimestamp: now,
    });

    if (DEBUG_MODE) {
      console.log("[GA] New Session ID created:", newSessionId);
    }

    return newSessionId;
  } catch (error) {
    console.error("[GA] Error getting/creating session ID:", error);
    return Date.now().toString();
  }
}

/**
 * Google Analytics 이벤트 전송
 * @param eventName 이벤트 이름 (최대 40자, 영문/숫자/언더스코어)
 * @param eventParams 이벤트 파라미터 객체
 */
export async function sendGAEvent(
  eventName: string,
  eventParams: Record<string, GAEventParam> = {}
): Promise<void> {
  // API Secret이 없으면 전송하지 않음
  if (!API_SECRET) {
    console.warn(
      "[GA] API Secret not configured. Event not sent:",
      eventName
    );
    return;
  }

  if (DEBUG_MODE) {
    console.log("[GA] API Secret configured:", API_SECRET?.substring(0, 4) + "...");
    console.log("[GA] Environment:", ENVIRONMENT);
  }

  try {
    const clientId = await getOrCreateClientId();
    const sessionId = await getOrCreateSessionId();

    const payload = {
      client_id: clientId,
      events: [
        {
          name: eventName,
          params: {
            session_id: sessionId,
            engagement_time_msec: 100, // GA4에서 권장하는 최소값
            ...(DEBUG_MODE && { debug_mode: 1 }), // DebugView 활성화
            ...eventParams,
          },
        },
      ],
    };

    // 디버그 모드일 경우 debug endpoint 사용
    const endpoint = DEBUG_MODE ? GA_DEBUG_ENDPOINT : GA_ENDPOINT;

    const response = await fetch(
      `${endpoint}?measurement_id=${MEASUREMENT_ID}&api_secret=${API_SECRET}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (DEBUG_MODE) {
      console.log("[GA] Event sent:", eventName, eventParams);
      console.log("[GA] Payload:", JSON.stringify(payload, null, 2));
      console.log("[GA] Response status:", response.status, response.statusText);

      // Debug endpoint의 응답 확인
      if (response.ok) {
        const debugResponse = await response.json();
        console.log("[GA] Debug response:", debugResponse);
      } else {
        const errorText = await response.text();
        console.error("[GA] Response error:", errorText);
      }
    }
  } catch (error) {
    console.error("[GA] Error sending event:", error);
    if (DEBUG_MODE && error instanceof Error) {
      console.error("[GA] Error details:", error.message, error.stack);
    }
  }
}

/**
 * 페이지뷰 이벤트 전송
 * @param pageTitle 페이지 제목
 * @param pageLocation 페이지 경로 (선택)
 */
export async function sendPageView(
  pageTitle: string,
  pageLocation?: string
): Promise<void> {
  await sendGAEvent("page_view", {
    page_title: pageTitle,
    page_location: pageLocation || window.location.href || "unknown",
    page_referrer: document.referrer || "direct",
  });
}

/**
 * 링크 클릭 이벤트 전송
 * @param linkName 클릭한 링크 이름
 * @param linkUrl 링크 URL
 */
export async function sendLinkClick(
  linkName: string,
  linkUrl: string
): Promise<void> {
  await sendGAEvent("link_click", {
    link_name: linkName,
    link_url: linkUrl,
  });
}

/**
 * 탭 전환 이벤트 전송
 * @param tabName 전환한 탭 이름
 */
export async function sendTabChange(tabName: string): Promise<void> {
  await sendGAEvent("tab_change", {
    tab_name: tabName,
  });
}

/**
 * 버튼 클릭 이벤트 전송
 * @param buttonName 클릭한 버튼 이름
 * @param buttonLocation 버튼 위치 (선택)
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
 * 설정 변경 이벤트 전송
 * @param settingName 변경한 설정 이름
 * @param settingValue 변경된 값
 */
export async function sendSettingChange(
  settingName: string,
  settingValue: string
): Promise<void> {
  await sendGAEvent("setting_change", {
    setting_name: settingName,
    setting_value: settingValue,
  });
}

/**
 * 에러 발생 이벤트 전송
 * @param errorMessage 에러 메시지
 * @param errorLocation 에러 발생 위치
 */
export async function sendError(
  errorMessage: string,
  errorLocation: string
): Promise<void> {
  await sendGAEvent("error", {
    error_message: errorMessage,
    error_location: errorLocation,
  });
}
