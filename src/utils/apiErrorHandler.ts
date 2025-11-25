/**
 * API Error Handler Utilities
 * Centralized error message handling for API responses
 */

import type { ApiResponse } from '@/types/api';

/**
 * Get user-friendly error message based on API response
 * Handles common HTTP status codes and provides localized messages
 *
 * @param result - API response with potential error
 * @param defaultMessage - Fallback message if no specific error found
 * @returns User-friendly error message in Korean
 */
export function getErrorMessage(
  result: ApiResponse<unknown>,
  defaultMessage: string
): string {
  if (result.error) {
    // Check specific error codes
    if (result.status === 401) {
      return '로그인이 필요합니다. 다시 로그인해주세요.';
    } else if (result.status === 403) {
      return '권한이 없습니다.';
    } else if (result.status === 404) {
      return '템플릿을 찾을 수 없습니다.';
    } else if (result.status === 400) {
      return result.error.message || '잘못된 요청입니다.';
    } else if (result.status && result.status >= 500) {
      return '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
    }
    // Return specific error message from server if available
    return result.error.message || defaultMessage;
  }
  return defaultMessage;
}
