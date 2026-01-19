/**
 * Library Integration API
 * External service integration for Konkuk University Library seat reservation
 */

import {
  LibraryApiResponse,
  LibraryLoginData,
  LibraryLoginRequest,
  LibrarySeatRoomsData,
} from '@/types/api';

const LIBRARY_BASE_URL = 'https://library.konkuk.ac.kr';
const LIBRARY_API_URL = `${LIBRARY_BASE_URL}/pyxis-api`;

/**
 * 도서관 열람실 예약 페이지 URL 생성
 * @param roomId 열람실 ID
 * @returns 예약 페이지 URL
 */
export function getLibraryReservationUrl(roomId: number): string {
  return `${LIBRARY_BASE_URL}/library-services/smuf/reading-rooms/${roomId}`;
}

/**
 * 도서관 로그인 응답
 */
export interface LibraryLoginResponse {
  success: boolean;
  data?: LibraryLoginData;
  error?: string;
}

/**
 * 도서관 좌석 현황 응답
 */
export interface LibrarySeatRoomsResponse {
  success: boolean;
  needLogin?: boolean;
  data?: LibrarySeatRoomsData;
  error?: string;
}

/**
 * 도서관 로그인
 * @param loginId 사용자 ID (학번)
 * @param password 비밀번호
 * @returns 로그인 응답 (accessToken 포함)
 */
export async function libraryLoginAPI(
  loginId: string,
  password: string
): Promise<LibraryLoginResponse> {
  try {
    const requestBody: LibraryLoginRequest = {
      loginId,
      password,
      isFamilyLogin: false,
      isMobile: false,
    };

    const response = await fetch(`${LIBRARY_API_URL}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
      },
      body: JSON.stringify(requestBody),
      credentials: 'include',
    });

    const result: LibraryApiResponse<LibraryLoginData> = await response.json();

    if (result.success) {
      return {
        success: true,
        data: result.data,
      };
    } else {
      return {
        success: false,
        error: result.message || '로그인에 실패했습니다.',
      };
    }
  } catch (error) {
    console.error('[Library] Login error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 도서관 좌석 현황 조회
 * @param accessToken 인증 토큰 (pyxis-auth-token)
 * @returns 열람실 목록 및 좌석 현황
 */
export async function getLibrarySeatRoomsAPI(
  accessToken: string
): Promise<LibrarySeatRoomsResponse> {
  try {
    const response = await fetch(
      `${LIBRARY_API_URL}/1/seat-rooms?smufMethodCode=PC&branchGroupId=1`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          'pyxis-auth-token': accessToken,
        },
        credentials: 'include',
      }
    );

    const result: LibraryApiResponse<LibrarySeatRoomsData> =
      await response.json();

    // 빈 데이터가 오면 로그인 필요
    if (result.success && (!result.data.list || result.data.list.length === 0)) {
      return {
        success: false,
        needLogin: true,
        error: '로그인이 필요합니다.',
      };
    }

    if (result.success) {
      return {
        success: true,
        data: result.data,
      };
    } else {
      return {
        success: false,
        needLogin: true,
        error: result.message || '좌석 현황을 불러올 수 없습니다.',
      };
    }
  } catch (error) {
    console.error('[Library] Get seat rooms error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 브라우저 쿠키에서 도서관 인증 토큰 가져오기
 * 사용자가 도서관 사이트에 로그인한 상태면 쿠키에 토큰이 저장되어 있음
 * @returns accessToken 또는 null
 */
export async function getLibraryTokenFromCookie(): Promise<string | null> {
  try {
    // 크롬 익스텐션 환경에서만 사용 가능
    if (typeof chrome === 'undefined' || !chrome.cookies) {
      return null;
    }

    const cookie = await chrome.cookies.get({
      url: LIBRARY_BASE_URL,
      name: 'KONKUK_PYXIS3',
    });

    if (!cookie?.value) {
      return null;
    }

    // URL 디코딩 후 JSON 파싱
    const decoded = decodeURIComponent(cookie.value);
    const data = JSON.parse(decoded);

    // 만료 체크
    if (data.expireDate) {
      const expireDate = new Date(data.expireDate);
      if (expireDate < new Date()) {
        return null; // 토큰 만료됨
      }
    }

    return data.accessToken || null;
  } catch (error) {
    console.error('[Library] Failed to get token from cookie:', error);
    return null;
  }
}