/**
 * Background Script Message Types
 * Type definitions for communication between popup and background script
 */

import type { AccountProfile } from '../types/account';
import type {
  TimetableImportMode,
  TimetableImportResponse,
} from '../types/timetable';
import {
  isAnalyticsPayload,
  type AnalyticsPayload,
} from '../utils/analyticsContract.ts';
import type { AnalyticsTransportResponse } from '../utils/analyticsTransport.ts';

/**
 * Message types for popup -> background communication
 */
export enum BackgroundMessageType {
  GOOGLE_LOGIN = 'GOOGLE_LOGIN',
  TIMETABLE_IMPORT = 'TIMETABLE_IMPORT',
  ANALYTICS_BATCH = 'ANALYTICS_BATCH',
}

/**
 * Base message structure
 */
export interface BackgroundMessage<T = unknown> {
  type: BackgroundMessageType;
  data?: T;
}

/**
 * Google Login Request Message
 */
export interface GoogleLoginMessage extends BackgroundMessage {
  type: BackgroundMessageType.GOOGLE_LOGIN;
}

/**
 * Google Login Success Response
 */
export interface GoogleLoginSuccessResponse {
  success: true;
  profile: AccountProfile;
}

/**
 * Google Login Error Response
 */
export interface GoogleLoginErrorResponse {
  success: false;
  error: string;
}

/**
 * Google Login Response (Union type)
 */
export type GoogleLoginResponse = GoogleLoginSuccessResponse | GoogleLoginErrorResponse;

/**
 * Type guard for Google Login Message
 */
export function isGoogleLoginMessage(
  message: BackgroundMessage
): message is GoogleLoginMessage {
  return message.type === BackgroundMessageType.GOOGLE_LOGIN;
}

/**
 * Requests a one-off import from an existing Everytime timetable tab.
 * When no matching tab exists, the background worker opens one temporarily.
 */
export interface TimetableImportMessage extends BackgroundMessage {
  type: BackgroundMessageType.TIMETABLE_IMPORT;
  data?: { mode?: TimetableImportMode };
}

export function isTimetableImportMessage(
  message: BackgroundMessage,
): message is TimetableImportMessage {
  if (message.type !== BackgroundMessageType.TIMETABLE_IMPORT) {
    return false;
  }

  if (message.data === undefined) {
    return true;
  }

  if (typeof message.data !== "object" || message.data === null) {
    return false;
  }

  const mode = (message.data as { mode?: unknown }).mode;
  return mode === undefined || mode === "latest" || mode === "previous";
}

export interface AnalyticsBatchMessage extends BackgroundMessage {
  type: BackgroundMessageType.ANALYTICS_BATCH;
  data: { payload: AnalyticsPayload };
}

export function isAnalyticsBatchMessage(
  message: BackgroundMessage,
): message is AnalyticsBatchMessage {
  if (message.type !== BackgroundMessageType.ANALYTICS_BATCH) {
    return false;
  }

  if (
    typeof message.data !== "object" ||
    message.data === null ||
    !("payload" in message.data)
  ) {
    return false;
  }

  return isAnalyticsPayload(
    (message.data as { payload?: unknown }).payload,
  );
}

export type { AnalyticsTransportResponse, TimetableImportResponse };
