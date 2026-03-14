/**
 * Google Analytics 4 Measurement Protocol for Chrome Extension
 * Manifest V3 compatible analytics helper.
 */

import { getOrCreateClientId } from "./clientId";
import { getStorage, isExtensionEnvironment, setStorage } from "./chrome";

type GAEventParam = string | number | boolean;

const GA_ENDPOINT = "https://www.google-analytics.com/mp/collect";
const GA_DEBUG_ENDPOINT = "https://www.google-analytics.com/debug/mp/collect";
const MEASUREMENT_ID = "G-ECMY8N9FX4";
const API_SECRET = import.meta.env.VITE_GA_API_SECRET;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const ENVIRONMENT = import.meta.env.VITE_ENVIRONMENT || "production";
const DEBUG_MODE = ENVIRONMENT === "development";

async function getOrCreateSessionId(): Promise<string> {
  try {
    const sessionId = await getStorage<string>("sessionId");
    const sessionTimestamp = await getStorage<number>("sessionTimestamp");
    const now = Date.now();

    if (sessionId && sessionTimestamp) {
      const timeSinceLastActivity = now - sessionTimestamp;

      if (timeSinceLastActivity < SESSION_TIMEOUT_MS) {
        await setStorage({ sessionTimestamp: now });
        return sessionId;
      }
    }

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

export async function sendGAEvent(
  eventName: string,
  eventParams: Record<string, GAEventParam> = {}
): Promise<void> {
  if (!isExtensionEnvironment()) {
    if (DEBUG_MODE) {
      console.log("[GA] Skipping event outside extension context:", eventName);
    }
    return;
  }

  if (!API_SECRET) {
    console.warn("[GA] API Secret not configured. Event not sent:", eventName);
    return;
  }

  if (DEBUG_MODE) {
    console.log("[GA] API Secret configured:", `${API_SECRET.substring(0, 4)}...`);
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
            engagement_time_msec: 100,
            ...(DEBUG_MODE && { debug_mode: 1 }),
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

export async function sendLinkClick(
  linkName: string,
  linkUrl: string
): Promise<void> {
  await sendGAEvent("link_click", {
    link_name: linkName,
    link_url: linkUrl,
  });
}

export async function sendTabChange(tabName: string): Promise<void> {
  await sendGAEvent("tab_change", {
    tab_name: tabName,
  });
}

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
  settingValue: string
): Promise<void> {
  await sendGAEvent("setting_change", {
    setting_name: settingName,
    setting_value: settingValue,
  });
}

export async function sendError(
  errorMessage: string,
  errorLocation: string
): Promise<void> {
  await sendGAEvent("error", {
    error_message: errorMessage,
    error_location: errorLocation,
  });
}
