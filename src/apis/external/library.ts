/**
 * Library Integration API
 * External service integration for Konkuk University Library seat reservation
 */

import type {
  LibraryLoginData,
  LibraryLoginRequest,
  LibrarySeatRoom,
  LibrarySeatRoomsData,
} from "@/types/api";
import { recordBreadcrumb } from "@/monitoring";
import { errorLog, warnLogOnly } from "@/utils/logger";
import {
  classifyNetworkFailure,
  isExpectedNetworkFailure,
} from "@/utils/networkFailure";

const LIBRARY_BASE_URL = "https://library.konkuk.ac.kr";
const LIBRARY_API_URL = `${LIBRARY_BASE_URL}/pyxis-api`;
const LIBRARY_TOKEN_STORAGE_KEY = "libraryToken";
const LIBRARY_REQUEST_TIMEOUT_MS = 8_000;

export type LibraryFailureKind =
  | "auth"
  | "http"
  | "timeout"
  | "transport"
  | "invalid_response";

interface LibraryFailureResponse {
  success: false;
  failureKind: LibraryFailureKind;
  error: string;
  status?: number;
}

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
export type LibraryLoginResponse =
  | { success: true; data: LibraryLoginData }
  | LibraryFailureResponse;

/**
 * 도서관 좌석 현황 응답
 */
export type LibrarySeatRoomsResponse =
  | { success: true; data: LibrarySeatRoomsData; needLogin?: false }
  | (LibraryFailureResponse & { needLogin?: boolean });

export interface LibraryCredentials {
  id: string;
  password: string;
}

export interface LibrarySeatRoomsSessionDependencies {
  getStoredToken: () => Promise<string | null>;
  clearStoredToken: () => Promise<boolean>;
  login: (loginId: string, password: string) => Promise<LibraryLoginResponse>;
  setToken: (loginData: LibraryLoginData) => Promise<boolean>;
  getSeatRooms: (accessToken: string) => Promise<LibrarySeatRoomsResponse>;
}

interface LibraryTokenStorageData {
  accessToken: string;
  expireDate?: string;
}

interface LibraryResponseEnvelope {
  success: boolean;
  code?: unknown;
  message?: unknown;
  data?: unknown;
}

type LibraryOperation = "login" | "seat_rooms";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readLibraryResponseEnvelope(
  value: unknown,
): LibraryResponseEnvelope | null {
  if (!isRecord(value) || typeof value.success !== "boolean") {
    return null;
  }

  return {
    success: value.success,
    code: value.code,
    message: value.message,
    data: value.data,
  };
}

function readLibraryMessage(
  envelope: LibraryResponseEnvelope,
  fallback: string,
): string {
  return typeof envelope.message === "string" && envelope.message.trim()
    ? envelope.message
    : fallback;
}

function isLoginData(value: unknown): value is LibraryLoginData {
  return (
    isRecord(value) &&
    typeof value.accessToken === "string" &&
    value.accessToken.length > 0
  );
}

function isSeatRoom(value: unknown): value is LibrarySeatRoom {
  if (!isRecord(value) || !isRecord(value.seats)) {
    return false;
  }

  return (
    typeof value.id === "number" &&
    Number.isFinite(value.id) &&
    typeof value.name === "string" &&
    typeof value.seats.total === "number" &&
    Number.isFinite(value.seats.total) &&
    typeof value.seats.occupied === "number" &&
    Number.isFinite(value.seats.occupied) &&
    typeof value.seats.available === "number" &&
    Number.isFinite(value.seats.available)
  );
}

function isSeatRoomsData(value: unknown): value is LibrarySeatRoomsData {
  return (
    isRecord(value) &&
    typeof value.totalCount === "number" &&
    Number.isFinite(value.totalCount) &&
    Array.isArray(value.list) &&
    value.list.every(isSeatRoom)
  );
}

function isAuthFailure(envelope: LibraryResponseEnvelope): boolean {
  const authDescription = `${String(envelope.code ?? "")} ${String(
    envelope.message ?? "",
  )}`;
  return /auth|login|token|unauthori[sz]ed|forbidden|인증|로그인|토큰|만료/iu.test(
    authDescription,
  );
}

function getLibraryFailureMessage(kind: LibraryFailureKind): string {
  switch (kind) {
    case "auth":
      return "도서관 인증이 만료되었습니다.";
    case "http":
      return "도서관 서버가 일시적으로 응답하지 않습니다. 잠시 후 다시 시도해주세요.";
    case "timeout":
      return "도서관 서버 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요.";
    case "transport":
      return "네트워크 연결을 확인한 후 다시 시도해주세요.";
    case "invalid_response":
      return "도서관 응답 형식이 올바르지 않습니다.";
  }
}

function reportLibraryFailure(
  operation: LibraryOperation,
  kind: LibraryFailureKind,
  error?: unknown,
  status?: number,
): void {
  recordBreadcrumb(
    "library.request",
    "library request failed",
    {
      operation,
      failure_kind: kind,
      ...(status === undefined ? {} : { status }),
    },
    kind === "invalid_response" ? "error" : "warning",
  );

  if (kind === "timeout" || kind === "transport") {
    warnLogOnly(`[Library] ${operation} ${kind}`, error);
  } else if (kind === "invalid_response") {
    errorLog(
      `[Library] ${operation} returned an invalid response`,
      error ?? new Error("Invalid library response"),
    );
  }
}

function createFailure(
  kind: LibraryFailureKind,
  error?: string,
  status?: number,
): LibraryFailureResponse {
  return {
    success: false,
    failureKind: kind,
    error: error || getLibraryFailureMessage(kind),
    ...(status === undefined ? {} : { status }),
  };
}

function createRequestTimeout(): {
  signal: AbortSignal;
  clear: () => void;
} {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(
    () => controller.abort(),
    LIBRARY_REQUEST_TIMEOUT_MS,
  );

  return {
    signal: controller.signal,
    clear: () => globalThis.clearTimeout(timeoutId),
  };
}

function failureFromThrownRequest(
  operation: LibraryOperation,
  error: unknown,
): LibraryFailureResponse {
  const networkFailureKind = classifyNetworkFailure(error);
  const failureKind: LibraryFailureKind =
    networkFailureKind === "aborted"
      ? "timeout"
      : isExpectedNetworkFailure(error)
        ? "transport"
        : "invalid_response";

  reportLibraryFailure(operation, failureKind, error);
  return createFailure(failureKind);
}

function isLibraryTokenStorageData(
  value: unknown,
): value is LibraryTokenStorageData {
  if (!value || typeof value !== "object") {
    return false;
  }

  const tokenData = value as Record<string, unknown>;
  if (typeof tokenData.accessToken !== "string") {
    return false;
  }

  return (
    tokenData.expireDate === undefined ||
    typeof tokenData.expireDate === "string"
  );
}

/**
 * 도서관 로그인
 * @param loginId 사용자 ID (학번)
 * @param password 비밀번호
 * @returns 로그인 응답 (accessToken 포함)
 */
export async function libraryLoginAPI(
  loginId: string,
  password: string,
): Promise<LibraryLoginResponse> {
  const timeout = createRequestTimeout();

  try {
    const requestBody: LibraryLoginRequest = {
      loginId,
      password,
      isFamilyLogin: false,
      isMobile: false,
    };

    const response = await fetch(`${LIBRARY_API_URL}/api/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
      },
      body: JSON.stringify(requestBody),
      credentials: "include",
      signal: timeout.signal,
    });

    if (response.status === 401 || response.status === 403) {
      reportLibraryFailure("login", "auth", undefined, response.status);
      return createFailure("auth", "학번 또는 비밀번호를 확인해주세요.", response.status);
    }

    if (!response.ok) {
      reportLibraryFailure("login", "http", undefined, response.status);
      return createFailure("http", undefined, response.status);
    }

    const result = readLibraryResponseEnvelope(await response.json());
    if (!result) {
      reportLibraryFailure("login", "invalid_response");
      return createFailure("invalid_response");
    }

    if (result.success) {
      if (!isLoginData(result.data)) {
        reportLibraryFailure("login", "invalid_response");
        return createFailure("invalid_response");
      }

      return {
        success: true,
        data: result.data,
      };
    }

    reportLibraryFailure("login", "auth");
    return createFailure(
      "auth",
      readLibraryMessage(result, "학번 또는 비밀번호를 확인해주세요."),
    );
  } catch (error) {
    return failureFromThrownRequest("login", error);
  } finally {
    timeout.clear();
  }
}

/**
 * 도서관 좌석 현황 조회
 * @param accessToken 인증 토큰 (pyxis-auth-token)
 * @returns 열람실 목록 및 좌석 현황
 */
export async function getLibrarySeatRoomsAPI(
  accessToken: string,
): Promise<LibrarySeatRoomsResponse> {
  const timeout = createRequestTimeout();

  try {
    const response = await fetch(
      `${LIBRARY_API_URL}/1/seat-rooms?smufMethodCode=PC&branchGroupId=1`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json;charset=UTF-8",
          "pyxis-auth-token": accessToken,
        },
        credentials: "include",
        signal: timeout.signal,
      },
    );

    if (response.status === 401 || response.status === 403) {
      reportLibraryFailure("seat_rooms", "auth", undefined, response.status);
      return {
        ...createFailure("auth", undefined, response.status),
        needLogin: true,
      };
    }

    if (!response.ok) {
      reportLibraryFailure("seat_rooms", "http", undefined, response.status);
      return createFailure("http", undefined, response.status);
    }

    const result = readLibraryResponseEnvelope(await response.json());
    if (!result) {
      reportLibraryFailure("seat_rooms", "invalid_response");
      return createFailure("invalid_response");
    }

    if (!result.success) {
      const failureKind: LibraryFailureKind = isAuthFailure(result)
        ? "auth"
        : "http";
      reportLibraryFailure("seat_rooms", failureKind);
      return {
        ...createFailure(
          failureKind,
          readLibraryMessage(result, getLibraryFailureMessage(failureKind)),
        ),
        ...(failureKind === "auth" ? { needLogin: true } : {}),
      };
    }

    if (!isSeatRoomsData(result.data)) {
      reportLibraryFailure("seat_rooms", "invalid_response");
      return createFailure("invalid_response");
    }

    return {
      success: true,
      data: result.data,
    };
  } catch (error) {
    return failureFromThrownRequest("seat_rooms", error);
  } finally {
    timeout.clear();
  }
}

/**
 * 도서관 인증 토큰을 chrome.storage에 저장
 * @param loginData 로그인 응답 데이터
 */
export async function setLibraryToken(
  loginData: LibraryLoginData,
): Promise<boolean> {
  try {
    if (typeof chrome === "undefined" || !chrome.storage) {
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
    errorLog("[Library] Failed to set token:", error);
    return false;
  }
}

/**
 * chrome.storage에서 도서관 인증 토큰 가져오기
 * @returns accessToken 또는 null
 */
export async function getLibraryTokenFromStorage(): Promise<string | null> {
  try {
    if (typeof chrome === "undefined" || !chrome.storage) {
      return null;
    }

    const result = await chrome.storage.local.get(LIBRARY_TOKEN_STORAGE_KEY);
    const rawData = result[LIBRARY_TOKEN_STORAGE_KEY];

    if (!isLibraryTokenStorageData(rawData)) {
      return null;
    }

    const data = rawData;

    if (!data.accessToken) {
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
    errorLog("[Library] Failed to get token from storage:", error);
    return null;
  }
}

/** 저장된 도서관 토큰을 제거합니다. 인증 거절 뒤 한 번만 재로그인할 때 사용합니다. */
export async function clearLibraryToken(): Promise<boolean> {
  try {
    if (typeof chrome === "undefined" || !chrome.storage) {
      return false;
    }

    await chrome.storage.local.remove(LIBRARY_TOKEN_STORAGE_KEY);
    return true;
  } catch (error) {
    errorLog("[Library] Failed to clear token:", error);
    return false;
  }
}

/**
 * 저장 토큰을 우선 사용하고, 서버가 그 토큰을 인증 거절한 경우에만 한 번
 * 재로그인합니다. 새 토큰도 거절되면 더 이상 반복하지 않습니다.
 */
export async function loadLibrarySeatRoomsAPI(
  credentials: LibraryCredentials | null,
  dependencies: LibrarySeatRoomsSessionDependencies = {
    getStoredToken: getLibraryTokenFromStorage,
    clearStoredToken: clearLibraryToken,
    login: libraryLoginAPI,
    setToken: setLibraryToken,
    getSeatRooms: getLibrarySeatRoomsAPI,
  },
): Promise<LibrarySeatRoomsResponse> {
  const loginOnce = async (): Promise<
    { token: string } | { response: LibrarySeatRoomsResponse }
  > => {
    if (!credentials) {
      return {
        response: {
          ...createFailure("auth", "eCampus 로그인 정보가 필요합니다."),
          needLogin: true,
        },
      };
    }

    const loginResponse = await dependencies.login(
      credentials.id,
      credentials.password,
    );
    if (!loginResponse.success) {
      return {
        response: {
          ...loginResponse,
          ...(loginResponse.failureKind === "auth" ? { needLogin: true } : {}),
        },
      };
    }

    await dependencies.setToken(loginResponse.data);
    return { token: loginResponse.data.accessToken };
  };

  const storedToken = await dependencies.getStoredToken();
  if (!storedToken) {
    const loginResult = await loginOnce();
    if ("response" in loginResult) {
      return loginResult.response;
    }

    const response = await dependencies.getSeatRooms(loginResult.token);
    if (response.needLogin) {
      await dependencies.clearStoredToken();
    }
    return response;
  }

  const storedTokenResponse = await dependencies.getSeatRooms(storedToken);
  if (!storedTokenResponse.needLogin) {
    return storedTokenResponse;
  }

  await dependencies.clearStoredToken();
  const loginResult = await loginOnce();
  if ("response" in loginResult) {
    return loginResult.response;
  }

  const refreshedResponse = await dependencies.getSeatRooms(loginResult.token);
  if (refreshedResponse.needLogin) {
    await dependencies.clearStoredToken();
  }
  return refreshedResponse;
}

/**
 * 도서관 예약 페이지 열기
 * 사용자가 직접 로그인하면 바로 예약 화면으로 이동됨
 * @param roomId 열람실 ID
 */
export async function openLibraryReservationPage(
  roomId: number,
): Promise<void> {
  const url = getLibraryReservationUrl(roomId);
  await chrome.tabs.create({ url });
}
