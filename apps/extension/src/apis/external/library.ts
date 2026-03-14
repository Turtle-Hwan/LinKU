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
const LIBRARY_TOKEN_STORAGE_KEY = 'libraryToken';

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

    if (!result.success) {
      return {
        success: false,
        needLogin: true,
        error: result.message || '좌석 현황을 불러올 수 없습니다.',
      };
    }

    // 빈 데이터가 오면 로그인 필요
    if (!result.data.list || result.data.list.length === 0) {
      return {
        success: false,
        needLogin: true,
        error: '로그인이 필요합니다.',
      };
    }

    return {
      success: true,
      data: result.data,
    };
  } catch (error) {
    console.error('[Library] Get seat rooms error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 도서관 인증 토큰을 chrome.storage에 저장
 * @param loginData 로그인 응답 데이터
 */
export async function setLibraryToken(
  loginData: LibraryLoginData
): Promise<boolean> {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      return false;
    }

    // 만료 시간 설정 (현재 시간 + 1시간)
    const expireDate = new Date();
    expireDate.setHours(expireDate.getHours() + 1);

    await chrome.storage.local.set({
      [LIBRARY_TOKEN_STORAGE_KEY]: {
        accessToken: loginData.accessToken,
        expireDate: expireDate.toISOString(),
      },
    });

    return true;
  } catch (error) {
    console.error('[Library] Failed to set token:', error);
    return false;
  }
}

/**
 * chrome.storage에서 도서관 인증 토큰 가져오기
 * @returns accessToken 또는 null
 */
export async function getLibraryTokenFromStorage(): Promise<string | null> {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      return null;
    }

    const result = await chrome.storage.local.get(LIBRARY_TOKEN_STORAGE_KEY);
    const data = result[LIBRARY_TOKEN_STORAGE_KEY];

    if (!data?.accessToken) {
      return null;
    }

    // 만료 체크
    if (data.expireDate) {
      const expireDate = new Date(data.expireDate);
      if (expireDate < new Date()) {
        // 만료된 토큰 삭제
        await chrome.storage.local.remove(LIBRARY_TOKEN_STORAGE_KEY);
        return null;
      }
    }

    return data.accessToken;
  } catch (error) {
    console.error('[Library] Failed to get token from storage:', error);
    return null;
  }
}

/**
 * 도서관 예약 페이지 열기
 * 사용자가 직접 로그인하면 바로 예약 화면으로 이동됨
 * @param roomId 열람실 ID
 */
export async function openLibraryReservationPage(roomId: number): Promise<void> {
  const url = getLibraryReservationUrl(roomId);
  await chrome.tabs.create({ url });
}
