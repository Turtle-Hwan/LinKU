import { eCampusLoginAPI, eCampusTodoListAPI } from "@/apis";
import type { ECampusTodoItem } from "@/types/todo";
import {
  clearECampusCredentials,
  loadECampusCredentials,
} from "@/utils/credentials";
import { debugLog, errorLog } from "@/utils/logger";

export interface LoadECampusTodosOptions {
  allowAutoLogin?: boolean;
  clearExpiredCredentials?: boolean;
}

export interface LoadECampusTodosResult {
  success: boolean;
  todos: ECampusTodoItem[];
  error?: string;
  needsLogin?: boolean;
  loginOutcome?:
    | "none"
    | "auto-login-succeeded"
    | "network-error"
    | "credential-expired";
}

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

export const loadECampusTodos = async (
  options: LoadECampusTodosOptions = {}
): Promise<LoadECampusTodosResult> => {
  const { allowAutoLogin = true, clearExpiredCredentials = true } = options;

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

    const loginResult = await eCampusLoginAPI(
      credentials.id,
      credentials.password
    );

    if (loginResult.success) {
      const retryResult = await fetchECampusTodos();
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
      if (clearExpiredCredentials) {
        await clearECampusCredentials();
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
