chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "login") {
    fetch("http://ecampus.konkuk.ac.kr/ilos/lo/login.acl?data=jsonLogin", {
      method: "POST",
      body: request.body,
      headers: request.headers,
      credentials: "include",
      referrer: "https://ecampus.konkuk.ac.kr/ilos/main/member/login_form.acl",
    })
      .then((response) => {
        response;
      })
      .then((data) => sendResponse({ success: true, data }))
      .catch((error) =>
        sendResponse({ success: false, error: error.toString() })
      );
    return true; // 비동기 응답을 위해 true 반환
  }
});
