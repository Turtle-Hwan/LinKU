/**
 * eCampus Integration API
 * External service integration for Konkuk University eCampus
 */

import { ECampusTodoItem } from '@/types/todo';
import { captureErrorLog, warnLog } from '@/utils/logger';
import { isExtensionEnvironment } from '@/utils/chrome';
import { recordBreadcrumb } from '@/monitoring';
import {
  classifyNetworkFailure,
  isExpectedNetworkFailure,
} from '@/utils/networkFailure';
import { calculateDDay } from '@/utils/todo/dateFormat';
import { buildECampusLoginBody } from './ecampusLoginBody';

export interface ECampusLoginResponse {
  success: boolean;
  data?: {
    isError: boolean;
    message: string;
    count?: number;
    returnURL?: string;
    ids_yn?: string;
    VERIFY?: string;
  };
  error?: string;
}

export interface ECampusTodoResponse {
  success: boolean;
  needLogin?: boolean;
  data?: {
    todoList?: ECampusTodoItem[];
    [key: string]: unknown;
  };
  error?: unknown;
}

export interface ECampusGoLectureResponse {
  success: boolean;
  isError?: boolean;
  message?: string;
  error?: string;
}

const LOCAL_SAMPLE_LECTURE_URL = '__LOCAL_SAMPLE_ECAMPUS_TODO__';
const ECAMPUS_LOGIN_TIMEOUT_MS = 10_000;

type ECampusLoginPayload = NonNullable<ECampusLoginResponse['data']>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseECampusLoginPayload(responseText: string): ECampusLoginPayload {
  const trimmedText = responseText.trim();
  const callbackMatch =
    /^jsonLogin\s*\(\s*([\s\S]*?)\s*\)\s*;?\s*$/u.exec(trimmedText);
  const parsed: unknown = JSON.parse(callbackMatch?.[1] ?? trimmedText);

  if (
    !isRecord(parsed) ||
    typeof parsed.isError !== 'boolean' ||
    typeof parsed.message !== 'string'
  ) {
    throw new TypeError('eCampus login response has an invalid payload');
  }

  return parsed as ECampusLoginPayload;
}

const isLocalSampleMode = () => {
  return import.meta.env.MODE === 'development' && !isExtensionEnvironment();
};

const pad = (value: number) => String(value).padStart(2, '0');

const formatECampusDueDate = (date: Date) => {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = date.getHours();
  const minutes = pad(date.getMinutes());
  const period = hours < 12 ? '오전' : '오후';
  const twelveHour = hours % 12 === 0 ? 12 : hours % 12;

  return `${year}.${month}.${day} ${period} ${twelveHour}:${minutes}`;
};

const createLocalSampleTodo = (
  id: string,
  title: string,
  subject: string,
  dueAt: Date,
  kj: string,
  seq: string,
  gubun: string
): ECampusTodoItem => {
  const dueDate = formatECampusDueDate(dueAt);
  const dDay = calculateDDay(
    `${dueAt.getFullYear()}.${pad(dueAt.getMonth() + 1)}.${pad(dueAt.getDate())}`,
    `${pad(dueAt.getHours())}:${pad(dueAt.getMinutes())}`
  );

  return {
    type: 'ecampus',
    id,
    title,
    subject,
    dDay,
    dueDate,
    kj,
    gubun,
    seq,
  };
};

const getLocalSampleTodos = (): ECampusTodoItem[] => {
  const now = new Date();

  const urgentDue = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  urgentDue.setSeconds(0, 0);

  const todayDue = new Date(now);
  todayDue.setHours(23, 59, 0, 0);

  const tomorrowMorningDue = new Date(now);
  tomorrowMorningDue.setDate(tomorrowMorningDue.getDate() + 1);
  tomorrowMorningDue.setHours(10, 0, 0, 0);

  return [
    createLocalSampleTodo(
      'ecampus-local-1',
      '캡스톤디자인 발표 자료 제출',
      '캡스톤디자인',
      urgentDue,
      'local-kj-1',
      'local-seq-1',
      'report'
    ),
    createLocalSampleTodo(
      'ecampus-local-2',
      '운영체제 퀴즈 응시',
      '운영체제',
      todayDue,
      'local-kj-2',
      'local-seq-2',
      'quiz'
    ),
    createLocalSampleTodo(
      'ecampus-local-3',
      '자료구조 5주차 강의 시청',
      '자료구조',
      tomorrowMorningDue,
      'local-kj-3',
      'local-seq-3',
      'lecture_weeks'
    ),
  ];
};

/**
 * Login to eCampus
 * @param userId User ID
 * @param userPw User Password
 * @returns Login response with session
 */
export async function eCampusLoginAPI(
  userId: string,
  userPw: string
): Promise<ECampusLoginResponse> {
  if (isLocalSampleMode()) {
    return {
      success: true,
      data: {
        isError: false,
        message: `${userId || 'local-user'} 로컬 로그인 성공`,
        count: 0,
        returnURL: '/local/ecampus',
        ids_yn: 'Y',
        VERIFY: 'LOCAL_SAMPLE_MODE',
      },
    };
  }

  const controller = new AbortController();
  let didTimeout = false;
  const timeoutId = globalThis.setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, ECAMPUS_LOGIN_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(
      'https://ecampus.konkuk.ac.kr/ilos/lo/login.acl?data=jsonLogin',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        body: buildECampusLoginBody(userId, userPw),
        credentials: 'include',
        signal: controller.signal,
      }
    );
  } catch (error) {
    const networkFailureKind = classifyNetworkFailure(error);

    if (didTimeout) {
      recordBreadcrumb(
        'ecampus.network',
        'login request timed out',
        { timeout_ms: ECAMPUS_LOGIN_TIMEOUT_MS },
        'warning',
      );
      warnLog('eCampus login request timed out:', error);
      return {
        success: false,
        error: 'eCampus 로그인 요청 시간이 초과되었습니다.',
      };
    }

    recordBreadcrumb(
      'ecampus.network',
      'login request transport failed',
      { network_failure_kind: networkFailureKind },
      'warning',
    );
    if (isExpectedNetworkFailure(error)) {
      warnLog('eCampus login transport failed:', error);
    } else {
      captureErrorLog('eCampus login request failed unexpectedly:', error);
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    globalThis.clearTimeout(timeoutId);
  }

  if (!response.ok) {
    recordBreadcrumb(
      'ecampus.network',
      'login request returned non-success status',
      { status: response.status },
      response.status >= 500 ? 'error' : 'warning',
    );
    warnLog('eCampus login returned non-success status:', {
      status: response.status,
      statusText: response.statusText,
    });
    return {
      success: false,
      error: `eCampus 로그인 요청에 실패했습니다. (${response.status})`,
    };
  }

  try {
    // The endpoint normally wraps JSON in jsonLogin(...), but accepting plain
    // JSON keeps the parser compatible with equivalent success responses.
    const responseText = await response.text();
    const data = parseECampusLoginPayload(responseText);

    if (data.isError) {
      recordBreadcrumb(
        'ecampus.auth',
        'login credentials were rejected',
        undefined,
        'info',
      );
    }

    return {
      success: data.isError === false,
      data,
    };
  } catch (error) {
    // A 200 response that cannot satisfy the documented login contract is an
    // integration defect. This branch is the sole capture owner for it.
    captureErrorLog('eCampus login returned an invalid success payload:', error);
    return {
      success: false,
      error: 'eCampus 로그인 응답을 처리하지 못했습니다.',
    };
  }
}

/**
 * Fetch eCampus todo list
 * @returns Todo list response
 */
export async function eCampusTodoListAPI(): Promise<ECampusTodoResponse> {
  if (isLocalSampleMode()) {
    return {
      success: true,
      data: {
        todoList: getLocalSampleTodos(),
      },
    };
  }

  try {
    const response = await fetch(
      'https://ecampus.konkuk.ac.kr/ilos/mp/todo_list.acl',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'x-requested-with': 'XMLHttpRequest',
        },
        body: 'todoKjList=&chk_cate=ALL&encoding=utf-8',
        credentials: 'include',
      }
    );

    if (!response.ok) {
      recordBreadcrumb(
        "ecampus.network",
        "todo request returned non-success status",
        { status: response.status },
        "warning",
      );
      return {
        success: false,
        error: new Error(
          `eCampus todo request failed: ${response.status} ${response.statusText}`,
        ),
      };
    }

    const htmlText = await response.text();

    // Parse HTML using DOM parser
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');

    // Check if login is required
    if (htmlText.includes('alert')) {
      return { success: false, needLogin: true };
    }

    // Parse TodoList items
    const todoItems: ECampusTodoItem[] = [];
    const todoWraps = doc.querySelectorAll('.todo_wrap:not(.no_data)');

    todoWraps.forEach((item, index) => {
      const kj =
        (item.querySelector(`#kj_${index}`) as HTMLInputElement)?.value || '';
      const gubun =
        (item.querySelector(`#gubun_${index}`) as HTMLInputElement)?.value ||
        '';
      const seq =
        (item as HTMLElement)
          .getAttribute('onclick')
          ?.match(/goLecture\('.*?','(.*?)','.*?'\)/)?.[1] || '';
      const title =
        item.querySelector('.todo_title')?.textContent?.trim() || '';
      const subject =
        item.querySelector('.todo_subjt')?.textContent?.trim() || '';
      const dDay = item.querySelector('.todo_d_day')?.textContent?.trim() || '';
      const dueDate =
        item
          .querySelector('.todo_date span:not(.todo_d_day)')
          ?.textContent?.trim() || '';

      if (!title) return;

      todoItems.push({
        type: 'ecampus',
        id: `ecampus-${index}`,
        title,
        subject,
        dDay,
        dueDate,
        kj,
        gubun,
        seq,
      });
    });

    return {
      success: true,
      data: {
        todoList: todoItems,
      },
    };
  } catch (error) {
    const networkFailureKind = classifyNetworkFailure(error);
    recordBreadcrumb(
      'ecampus.network',
      'todo request transport failed',
      { network_failure_kind: networkFailureKind },
      'warning',
    );
    if (isExpectedNetworkFailure(error)) {
      warnLog('Failed to fetch todo list:', error);
    } else {
      captureErrorLog('Failed to process todo list:', error);
    }
    return { success: false, error };
  }
}

/**
 * Navigate to eCampus lecture
 * @param kj Lecture key
 * @param seq Sequence number
 * @param gubun Category (lecture_weeks, report, etc.)
 * @returns Authentication result and lecture URL
 */
export async function eCampusGoLectureAPI(
  kj: string,
  seq: string,
  gubun: string
): Promise<ECampusGoLectureResponse> {
  if (isLocalSampleMode()) {
    return {
      success: true,
      isError: false,
      message: LOCAL_SAMPLE_LECTURE_URL,
    };
  }

  const lectureUrl = `/ilos/mp/todo_list_connect.acl?SEQ=${seq}&gubun=${gubun}&KJKEY=${kj}`;

  return {
    success: true,
    isError: false,
    message: lectureUrl,
  };
}

export { LOCAL_SAMPLE_LECTURE_URL };
