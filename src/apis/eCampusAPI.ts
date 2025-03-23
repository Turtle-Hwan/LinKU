export async function eCampusLoginAPI(userId, userPw) {
  chrome.runtime.sendMessage(
    {
      action: "login",
      body: `usr_id=${userId}&usr_pwd=${userPw}&campus_div=1&encoding=utf-8`,
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
    },
    (response) => {
      console.log(response);
    }
  );
  // try {
  //   const response = await fetch(
  //     "https://ecampus.konkuk.ac.kr/ilos/lo/login.acl?data=jsonLogin",
  //     {
  //       method: "POST",
  //       headers: {
  //         "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
  //         "x-requested-with": "XMLHttpRequest",
  //       },
  //       body: `usr_id=${userId}&usr_pwd=${userPw}&campus_div=1&encoding=utf-8`,
  //       credentials: "include",
  //     }
  //   );

  //   // 로그인 성공 여부 확인 (응답 내용에 따라 수정 필요)
  //   const data = await response.json();
  //   return { success: true, data };
  // } catch (error) {
  //   console.error("Login error:", error);
  //   return { success: false, error };
  // }
}

export async function eCampusTodoListAPI() {
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

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error("Failed to fetch todo list:", error);
    // 로그인이 필요한지 확인 (응답 내용에 따라 수정 필요)
    return { success: false, needLogin: true, error };
  }
}
