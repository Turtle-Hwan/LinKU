/**
 * Background Script Message Types
 * Type definitions for communication between popup and background script
 */

import type { GoogleOAuthResponse } from '../types/api';

/**
 * Message types for popup -> background communication
 */
export enum BackgroundMessageType {
  GOOGLE_LOGIN = 'GOOGLE_LOGIN',
  SILENT_REAUTH = 'SILENT_REAUTH',
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
  response: GoogleOAuthResponse;
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
 * Silent Reauth Request Message
 * Used when token expires (5004 error) - triggers OAuth without user interaction
 */
export interface SilentReauthMessage extends BackgroundMessage {
  type: BackgroundMessageType.SILENT_REAUTH;
}

/**
 * Silent Reauth Response
 */
export interface SilentReauthResponse {
  success: boolean;
  error?: string;
}

/**
 * Type guard for Silent Reauth Message
 */
export function isSilentReauthMessage(
  message: BackgroundMessage
): message is SilentReauthMessage {
  return message.type === BackgroundMessageType.SILENT_REAUTH;
}
