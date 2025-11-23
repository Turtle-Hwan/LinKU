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
