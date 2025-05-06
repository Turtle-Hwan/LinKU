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
        credentials: "include", // 브라우저가 자동으로 쿠키를 저장하도록 함
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
  // 저장된 쿠키 정보 확인
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(["eCampusCookies"], async (result) => {
      console.log("eCampusCookies", result);

      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      try {
        // 저장된 쿠키가 있으면 해당 쿠키를 사용하여 요청
        const response = await fetch(
          "https://ecampus.konkuk.ac.kr/ilos/mp/todo_list.acl",
          {
            method: "POST",
            headers: {
              "content-type":
                "application/x-www-form-urlencoded; charset=UTF-8",
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
        if (
          htmlText.includes("login_alert") ||
          !doc.querySelectorAll(".todo_wrap").length
        ) {
          resolve({ success: false, needLogin: true });
          return;
        }

        // TodoList 항목 파싱
        const todoItems: TodoItem[] = [];
        const todoWraps = doc.querySelectorAll(".todo_wrap:not(.no_data)");

        todoWraps.forEach((item, index) => {
          const courseId =
            (item.querySelector(`#kj_${index}`) as HTMLInputElement)?.value ||
            "";
          const gubun =
            (item.querySelector(`#gubun_${index}`) as HTMLInputElement)
              ?.value || "";
          const title =
            item.querySelector(".todo_title")?.textContent?.trim() || "";
          const subject =
            item.querySelector(".todo_subjt")?.textContent?.trim() || "";
          const dDay =
            item.querySelector(".todo_d_day")?.textContent?.trim() || "";
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

        resolve({
          success: true,
          data: {
            todoList: todoItems,
          },
        });
      } catch (error) {
        console.error("Failed to fetch todo list:", error);
        resolve({ success: false, needLogin: true, error });
      }
    });
  });
}
