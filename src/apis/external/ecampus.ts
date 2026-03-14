/**
 * eCampus Integration API
 * External service integration for Konkuk University eCampus
 */

import { ECampusTodoItem } from '@/types/todo';
import { isExtensionEnvironment } from '@/utils/chrome';
import { calculateDDay } from '@/utils/todo/dateFormat';

export interface ECampusLoginResponse {
  success: boolean;
  data?: {
    isError: boolean;
    message: string;
    count: number;
    returnURL: string;
    ids_yn: string;
    VERIFY: string;
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

  try {
    const response = await fetch(
      'https://ecampus.konkuk.ac.kr/ilos/lo/login.acl?data=jsonLogin',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        body: `usr_id=${userId}&usr_pwd=${userPw}&campus_div=1&encoding=utf-8`,
        credentials: 'include',
      }
    );

    // Parse response text - comes in jsonLogin() format
    const responseText = await response.text();

    // Remove "jsonLogin (" and ");" and parse JSON
    const jsonText = responseText
      .replace(/\s*jsonLogin\s*\(\s*/, '')
      .replace(/\s*\)\s*;?\s*$/, '');
    const data = JSON.parse(jsonText);

    // Check login success - isError false means success
    const success = data && !data.isError;

    return {
      success,
      data,
    };
  } catch (error) {
    console.error('Login error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
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
    console.error('Failed to fetch todo list:', error);
    return { success: false, needLogin: true, error };
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

  try {
    const lectureUrl = `/ilos/mp/todo_list_connect.acl?SEQ=${seq}&gubun=${gubun}&KJKEY=${kj}`;

    return {
      success: true,
      isError: false,
      message: lectureUrl,
    };
  } catch (error) {
    console.error('Failed to access lecture:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export { LOCAL_SAMPLE_LECTURE_URL };
