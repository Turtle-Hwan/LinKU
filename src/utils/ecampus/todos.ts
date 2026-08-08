import {
  eCampusLoginAPI,
  eCampusTodoListAPI,
  type ECampusLoginResponse,
} from "@/apis";
import type { ECampusTodoItem } from "@/types/todo";
import {
  clearECampusCredentials,
  loadECampusCredentials,
} from "@/utils/credentials";
import { debugLog, errorLog } from "@/utils/logger";

import {
  createSerializedAuthQueue,
  type SerializedAuthAttempt,
} from "./authQueue";

export interface LoadECampusTodosOptions {
  allowAutoLogin?: boolean;
  clearExpiredCredentials?: boolean;
  expectedGeneration?: number;
}

export interface LoadECampusTodosResult {
  success: boolean;
  todos: ECampusTodoItem[];
  error?: string;
  needsLogin?: boolean;
  superseded?: boolean;
  loginOutcome?:
    | "none"
    | "auto-login-succeeded"
    | "network-error"
    | "credential-expired";
}

interface NormalizedLoadECampusTodosOptions {
  allowAutoLogin: boolean;
  clearExpiredCredentials: boolean;
}

interface CachedECampusTodosResult {
  expiresAt: number;
  result: LoadECampusTodosResult;
}

export type ECampusTodosChange = "clear" | "refresh";
type ECampusTodosChangeListener = (change: ECampusTodosChange) => void;

export type ECampusAccountLoginAttempt =
  | { superseded: true }
  | {
      superseded: false;
      result: ECampusLoginResponse;
      requestGeneration: number;
    };

const ECAMPUS_TODO_CACHE_TTL_MS = 30_000;
const cachedResults = new Map<string, CachedECampusTodosResult>();
const inFlightLoads = new Map<string, Promise<LoadECampusTodosResult>>();
const changeListeners = new Set<ECampusTodosChangeListener>();
const eCampusAuthQueue = createSerializedAuthQueue();
let cacheGeneration = 0;

const normalizeOptions = (
  options: LoadECampusTodosOptions,
): NormalizedLoadECampusTodosOptions => ({
  allowAutoLogin: options.allowAutoLogin ?? true,
  clearExpiredCredentials: options.clearExpiredCredentials ?? true,
});

const getRequestKey = ({
  allowAutoLogin,
  clearExpiredCredentials,
}: NormalizedLoadECampusTodosOptions) =>
  `${allowAutoLogin}:${clearExpiredCredentials}`;

const createSupersededResult = (): LoadECampusTodosResult => ({
  success: false,
  todos: [],
  superseded: true,
  loginOutcome: "none",
});

const withoutLoginOutcome = (
  result: LoadECampusTodosResult,
): LoadECampusTodosResult => ({
  ...result,
  loginOutcome: "none",
});

/**
 * 로그인 세션 또는 저장된 계정이 바뀌면 이전 계정의 cache와 진행 중 결과를 폐기한다.
 */
export const invalidateECampusTodosCache = (): number => {
  cacheGeneration += 1;
  cachedResults.clear();
  inFlightLoads.clear();
  return cacheGeneration;
};

export const isECampusAccountCurrent = (requestGeneration: number): boolean =>
  requestGeneration === cacheGeneration;

/**
 * 계정 변경 결과를 현재 열려 있는 Todo 화면에 명시적으로 전달한다.
 */
export const notifyECampusTodosChange = (change: ECampusTodosChange) => {
  changeListeners.forEach((listener) => listener(change));
};

export const subscribeECampusTodosChange = (
  listener: ECampusTodosChangeListener,
) => {
  changeListeners.add(listener);
  return () => {
    changeListeners.delete(listener);
  };
};

const authenticateECampusAccount = (
  userId: string,
  userPassword: string,
  requestGeneration: number,
): Promise<SerializedAuthAttempt<ECampusLoginResponse>> =>
  eCampusAuthQueue.run(
    () => requestGeneration === cacheGeneration,
    () => eCampusLoginAPI(userId, userPassword),
  );

/**
 * 수동 로그인도 자동 로그인과 같은 queue를 사용해 기존 세션을 덮어쓰지 않게 한다.
 */
export const loginECampusAccount = (
  userId: string,
  userPassword: string,
): Promise<ECampusAccountLoginAttempt> => {
  const requestGeneration = invalidateECampusTodosCache();
  return authenticateECampusAccount(
    userId,
    userPassword,
    requestGeneration,
  ).then((attempt) =>
    attempt.superseded
      ? attempt
      : { ...attempt, requestGeneration },
  );
};

const fetchECampusTodos = async (): Promise<LoadECampusTodosResult> => {
  try {
    const result = await eCampusTodoListAPI();

    if (result.success && result.data?.todoList) {
      return { success: true, todos: result.data.todoList, loginOutcome: "none" };
    }

    if (result.needLogin) {
      return { success: false, todos: [], needsLogin: true, loginOutcome: "none" };
    }

    return {
      success: false,
      todos: [],
      error: "eCampus 할 일을 불러오지 못했습니다.",
      loginOutcome: "none",
    };
  } catch (error) {
    errorLog("Error fetching todo list:", error);
    return {
      success: false,
      todos: [],
      error: "eCampus 할 일을 불러오는 중 오류가 발생했습니다.",
      loginOutcome: "none",
    };
  }
};

const loadECampusTodosUncached = async (
  options: NormalizedLoadECampusTodosOptions,
  requestGeneration: number,
): Promise<LoadECampusTodosResult> => {
  const { allowAutoLogin, clearExpiredCredentials } = options;

  const directResult = await fetchECampusTodos();
  if (directResult.success || !directResult.needsLogin) {
    return directResult;
  }

  if (!allowAutoLogin) {
    return directResult;
  }

  try {
    const credentials = await loadECampusCredentials();
    if (!credentials) {
      return directResult;
    }

    if (requestGeneration !== cacheGeneration) {
      return createSupersededResult();
    }

    const loginAttempt = await authenticateECampusAccount(
      credentials.id,
      credentials.password,
      requestGeneration,
    );
    if (loginAttempt.superseded) {
      return createSupersededResult();
    }

    const loginResult = loginAttempt.result;

    if (loginResult.success) {
      const retryResult = await fetchECampusTodos();
      if (requestGeneration !== cacheGeneration) {
        return createSupersededResult();
      }

      if (retryResult.success) {
        return {
          ...retryResult,
          loginOutcome: "auto-login-succeeded",
        };
      }

      return retryResult;
    }

    if (loginResult.error) {
      debugLog(
        "[Auto-login] Network error, keeping credentials:",
        loginResult.error,
      );
      return {
        success: false,
        todos: [],
        error: "eCampus 자동 로그인 중 네트워크 오류가 발생했습니다.",
        loginOutcome: "network-error",
      };
    }

    if (loginResult.data?.isError) {
      debugLog("[Auto-login] Auth failed, clearing credentials");
      if (clearExpiredCredentials && requestGeneration === cacheGeneration) {
        await clearECampusCredentials();
      }

      if (requestGeneration !== cacheGeneration) {
        return createSupersededResult();
      }

      return {
        success: false,
        todos: [],
        error: "저장된 로그인 정보가 만료되었습니다. 다시 로그인해주세요.",
        needsLogin: true,
        loginOutcome: "credential-expired",
      };
    }

    debugLog("[Auto-login] Unknown error, keeping credentials");
    return directResult;
  } catch (error) {
    errorLog("Error with saved credentials:", error);
    return directResult;
  }
};

/**
 * 한 popup 생명주기 안에서 같은 eCampus 요청을 공유한다.
 * 성공 결과만 짧게 캐시해 badge와 Todo 탭이 연달아 같은 요청을 보내지 않게 한다.
 */
export const loadECampusTodos = (
  options: LoadECampusTodosOptions = {},
): Promise<LoadECampusTodosResult> => {
  const requestGeneration = options.expectedGeneration ?? cacheGeneration;
  if (!isECampusAccountCurrent(requestGeneration)) {
    return Promise.resolve(createSupersededResult());
  }

  const normalizedOptions = normalizeOptions(options);
  const requestKey = getRequestKey(normalizedOptions);
  const cached = cachedResults.get(requestKey);

  if (cached && cached.expiresAt > Date.now()) {
    return Promise.resolve(cached.result);
  }
  cachedResults.delete(requestKey);

  const inFlight = inFlightLoads.get(requestKey);
  if (inFlight) {
    return inFlight;
  }

  const request = loadECampusTodosUncached(normalizedOptions, requestGeneration)
    .then((result) => {
      if (requestGeneration !== cacheGeneration) {
        return createSupersededResult();
      }

      if (result.success) {
        cachedResults.set(requestKey, {
          expiresAt: Date.now() + ECAMPUS_TODO_CACHE_TTL_MS,
          result: withoutLoginOutcome(result),
        });
      }

      return result;
    })
    .finally(() => {
      if (inFlightLoads.get(requestKey) === request) {
        inFlightLoads.delete(requestKey);
      }
    });

  inFlightLoads.set(requestKey, request);
  return request;
};
