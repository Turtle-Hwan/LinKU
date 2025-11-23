/**
 * Auth API
 * Authentication and verification operations
 */

import { post, ENDPOINTS } from './client';
import type {
  ApiResponse,
  GoogleOAuthRequest,
  GoogleOAuthResponse,
  SendCodeRequest,
  SendCodeResponse,
  VerifyCodeRequest,
  VerifyCodeResponse,
} from '../types/api';

/**
 * Google OAuth authorization
 * Login or get guest token through Google OAuth2
 */
export async function googleOAuth(
  data: GoogleOAuthRequest
): Promise<ApiResponse<GoogleOAuthResponse>> {
  return post<GoogleOAuthResponse>(ENDPOINTS.AUTH.GOOGLE_OAUTH, data);
}

/**
 * Send verification code to email
 * Send 6-digit verification code to Konkuk University email
 */
export async function sendVerificationCode(
  data: SendCodeRequest
): Promise<ApiResponse<SendCodeResponse>> {
  return post<SendCodeResponse>(ENDPOINTS.AUTH.SEND_CODE, data);
}

/**
 * Verify email code
 * Verify 6-digit code sent to email
 */
export async function verifyEmailCode(
  data: VerifyCodeRequest
): Promise<ApiResponse<VerifyCodeResponse>> {
  return post<VerifyCodeResponse>(ENDPOINTS.AUTH.VERIFY_CODE, data);
}
