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
 * POST /auth/send-code
 * @param data.kuMail - 건국대 이메일 (@konkuk.ac.kr)
 * @requires Authorization: Bearer {guest_token}
 */
export async function sendVerificationCode(
  data: SendCodeRequest
): Promise<ApiResponse<SendCodeResponse>> {
  return post<SendCodeResponse>(ENDPOINTS.AUTH.SEND_CODE, data);
}

/**
 * Verify email code
 * POST /auth/verify-code
 * @param data.kuMail - 건국대 이메일
 * @param data.authCode - 6자리 인증 코드
 * @requires Authorization: Bearer {guest_token}
 */
export async function verifyEmailCode(
  data: VerifyCodeRequest
): Promise<ApiResponse<VerifyCodeResponse>> {
  return post<VerifyCodeResponse>(ENDPOINTS.AUTH.VERIFY_CODE, data);
}
