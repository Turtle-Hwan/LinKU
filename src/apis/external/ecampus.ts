/**
 * eCampus Integration API
 * External service integration for Konkuk University eCampus
 */

import { ECampusTodoItem } from '@/types/todo';

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
