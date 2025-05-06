// eCampusAPI.js
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

export interface TodoItem {
  id: string;
  title: string;
  subject: string;
  dDay: string;
  dueDate: string;
  courseId: string;
  gubun: string;
}

export interface ECampusTodoResponse {
  success: boolean;
  needLogin?: boolean;
  data?: {
    todoList?: TodoItem[];
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

export async function eCampusLoginAPI(
  userId: string,
  userPw: string
): Promise<ECampusLoginResponse> {
  try {
    const response = await fetch(
      "https://ecampus.konkuk.ac.kr/ilos/lo/login.acl?data=jsonLogin",
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        body: `usr_id=${userId}&usr_pwd=${userPw}&campus_div=1&encoding=utf-8`,
        credentials: "include",
      }
    );

    // 응답 텍스트 가져오기 - jsonLogin () 형식으로 오기 때문에 파싱 필요
    const responseText = await response.text();

    // "jsonLogin (" 과 ")" 제거하고 JSON 파싱
    const jsonText = responseText
      .replace(/^jsonLogin\s*\(\s*/, "")
      .replace(/\s*\)\s*;?\s*$/, "");
    const data = JSON.parse(jsonText);

    // 로그인 성공 여부 확인 - isError가 false면 성공
    const success = data && !data.isError;

    return {
      success,
      data,
    };
  } catch (error) {
    console.error("Login error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function eCampusTodoListAPI(): Promise<ECampusTodoResponse> {
  try {
    const response = await fetch(
      "https://ecampus.konkuk.ac.kr/ilos/mp/todo_list.acl",
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          "x-requested-with": "XMLHttpRequest",
        },
        body: "todoKjList=&chk_cate=ALL&encoding=utf-8",
        credentials: "include",
      }
    );

    const htmlText = await response.text();

    // HTML 파싱: DOM 파서 사용
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, "text/html");

    // 로그인 필요 여부 확인
    if (htmlText.includes("alert")) {
      return { success: false, needLogin: true };
    }

    // TodoList 항목 파싱
    const todoItems: TodoItem[] = [];
    const todoWraps = doc.querySelectorAll(".todo_wrap:not(.no_data)");

    todoWraps.forEach((item, index) => {
      const courseId =
        (item.querySelector(`#kj_${index}`) as HTMLInputElement)?.value || "";
      const gubun =
        (item.querySelector(`#gubun_${index}`) as HTMLInputElement)?.value ||
        "";
      const title =
        item.querySelector(".todo_title")?.textContent?.trim() || "";
      const subject =
        item.querySelector(".todo_subjt")?.textContent?.trim() || "";
      const dDay = item.querySelector(".todo_d_day")?.textContent?.trim() || "";
      const dueDate =
        item
          .querySelector(".todo_date span:not(.todo_d_day)")
          ?.textContent?.trim() || "";

      todoItems.push({
        id: `${index}`,
        title,
        subject,
        dDay,
        dueDate,
        courseId,
        gubun,
      });
    });

    return {
      success: true,
      data: {
        todoList: todoItems,
      },
    };
  } catch (error) {
    console.error("Failed to fetch todo list:", error);
    return { success: false, needLogin: true, error };
  }
}

/**
 * 이캠퍼스 강의실로 이동하기 위한 인증 및 URL 생성 함수
 * @param kj 강의 키
 * @param seq 시퀀스 번호
 * @param gubun 구분 (lecture_weeks, report 등)
 * @returns 인증 결과 및 성공 시 이동할 URL
 */
export async function eCampusGoLectureAPI(
  kj: string,
  seq: string,
  gubun: string
): Promise<ECampusGoLectureResponse> {
  try {
    // 1. 먼저, 접근 권한 검사 요청
    const authResponse = await fetch(
      "https://ecampus.konkuk.ac.kr/ilos/lo/st_room_auth_check2.acl",
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        body: `returnData=json&ky=${kj}&encoding=utf-8`,
        credentials: "include",
      }
    );

    const authText = await authResponse.text();
    let authData;

    try {
      // 응답이 JSON 형태인지 확인
      authData = JSON.parse(authText);
    } catch (error) {
      // 로그인 세션이 만료되었거나 응답이 JSON이 아닌 경우
      return {
        success: false,
        isError: true,
        message: `로그인이 필요합니다. ${error}`,
      };
    }

    // 2. 인증 실패 시
    if (authData.isError) {
      return {
        success: false,
        isError: true,
        message: "해당 과목에 접근 권한이 없습니다.",
      };
    }

    // 3. 인증 성공 시 이동할 URL 생성
    const lectureUrl = `/ilos/mp/todo_list_connect.acl?SEQ=${seq}&gubun=${gubun}&KJKEY=${kj}`;

    return {
      success: true,
      isError: false,
      message: lectureUrl,
    };
  } catch (error) {
    console.error("Failed to access lecture:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
