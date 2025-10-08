// // content.js
// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//   if (request.action === "performLogin") {
//     performLogin(request.body)
//       .then((response) => sendResponse(response))
//       .catch((error) =>
//         sendResponse({ success: false, error: error.toString() })
//       );
//     return true; // 비동기 응답을 위해 true 반환
//   }
// });

// async function performLogin(body) {
//   try {
//     // 로그인 요청 보내기
//     const response = await fetch(
//       "https://ecampus.konkuk.ac.kr/ilos/lo/login.acl?data=jsonLogin",
//       {
//         method: "POST",
//         headers: {
//           "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
//           "x-requested-with": "XMLHttpRequest",
//         },
//         body: body,
//         credentials: "include", // 중요: 쿠키를 포함하도록 설정
//       }
//     );

//     // 응답 데이터 파싱
//     const data = await response.json();

//     return {
//       success: true,
//       data: data,
//     };
//   } catch (error) {
//     console.error("Login error in content script:", error);
//     return { success: false, error: error.toString(), data: response.json() };
//   }
// }
