/**
 * API Error Handler Utilities
 * Centralized error message handling and diagnostics for API responses
 */

import type { ApiResponse } from '@/types/api';

/**
 * Get detailed diagnostic information for API errors
 * Provides technical details useful for debugging and logging
 *
 * @param result - API response that may contain an error
 * @returns Detailed diagnostic message in Korean
 */
export function getErrorDiagnostics(result: ApiResponse<unknown>): string {
  const status = result.status;
  const errorCode = result.error?.code;
  const errorMessage = result.error?.message || 'Unknown error';

  // Network errors
  if (errorCode === 'NETWORK_ERROR') {
    return `네트워크 연결 실패 - 인터넷 연결을 확인해주세요. (${errorMessage})`;
  }

  // Parse errors
  if (errorCode === 'PARSE_ERROR') {
    return `응답 파싱 실패 - 서버 응답 형식 오류. (${errorMessage})`;
  }

  // HTTP status errors
  if (status) {
    switch (status) {
      case 401:
        return `인증 실패 (401) - 로그인이 필요하거나 토큰이 만료되었습니다. (${errorMessage})`;
      case 403:
        return `접근 권한 없음 (403) - 이 리소스에 접근할 권한이 없습니다. (${errorMessage})`;
      case 404:
        return `리소스 없음 (404) - 요청한 데이터를 찾을 수 없습니다. (${errorMessage})`;
      case 429:
        return `요청 제한 초과 (429) - 너무 많은 요청을 보냈습니다. 잠시 후 다시 시도해주세요. (${errorMessage})`;
      case 500:
      case 502:
      case 503:
      case 504:
        return `서버 오류 (${status}) - 서버에 일시적인 문제가 발생했습니다. (${errorMessage})`;
      default:
        if (status >= 400 && status < 500) {
          return `클라이언트 오류 (${status}) - 요청에 문제가 있습니다. (${errorMessage})`;
        }
        if (status >= 500) {
          return `서버 오류 (${status}) - 서버에 문제가 발생했습니다. (${errorMessage})`;
        }
    }
  }

  // Unknown error
  return `알 수 없는 오류 - ${errorCode}: ${errorMessage}`;
}

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
