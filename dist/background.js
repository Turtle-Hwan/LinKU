// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//   if (request.action === "login") {
//     fetch("https://ecampus.konkuk.ac.kr/ilos/lo/login.acl?data=jsonLogin", {
//       method: "POST",
//       body: request.body,
//       headers: request.headers,
//       credentials: "include",
//     })
//       .then(async (response) => {
//         // 응답에서 쿠키 추출
//         const cookies = {};
//         const setCookieHeaders = response.headers.getAll("set-cookie");

//         if (setCookieHeaders && setCookieHeaders.length > 0) {
//           setCookieHeaders.forEach((cookieStr) => {
//             const parts = cookieStr.split(";")[0].split("=");
//             if (parts.length === 2) {
//               cookies[parts[0].trim()] = parts[1].trim();
//             }
//           });
//         }

//         // 응답 데이터 추출
//         const data = await response.json();

//         // 쿠키 정보 저장
//         chrome.storage.local.set({ eCampusCookies: cookies });

//         // 응답 데이터와 쿠키를 함께 반환
//         sendResponse({
//           success: true,
//           data: data,
//           cookies: cookies,
//         });
//       })
//       .catch((error) =>
//         sendResponse({ success: false, error: error.toString() })
//       );
//     return true; // 비동기 응답을 위해 true 반환
//   }
// });

// // background.js
// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//   if (request.action === "login") {
//     // 숨겨진 탭을 열어 로그인 프로세스를 시작
//     console.log("Login request received:", request);
//     performSilentLogin(request.body, sendResponse);
//     return true; // 비동기 응답을 위해 true 반환
//   }
// });

// async function performSilentLogin(body, sendResponse) {
//   try {
//     // 숨겨진 탭 생성 (active: false로 설정하여 사용자에게 보이지 않게 함)
//     const tab = await chrome.tabs.create({
//       url: "https://ecampus.konkuk.ac.kr/ilos/main/member/login_form.acl",
//       active: false,
//     });

//     // 탭이 완전히 로드될 때까지 대기
//     await new Promise((resolve) => {
//       chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
//         if (tabId === tab.id && info.status === "complete") {
//           chrome.tabs.onUpdated.removeListener(listener);
//           resolve();
//         }
//       });
//     });

//     // content script에 로그인 요청 메시지 전송
//     chrome.tabs.sendMessage(
//       tab.id,
//       {
//         action: "performLogin",
//         body: body,
//       },
//       async (loginResponse) => {
//         console.log("Login response received:", loginResponse);

//         if (loginResponse && loginResponse.success) {
//           // 로그인 성공 후 쿠키 가져오기
//           const cookies = await chrome.cookies.getAll({
//             domain: "ecampus.konkuk.ac.kr",
//           });
//           console.log("Cookies after login:", cookies);

//           // 쿠키를 storage에 저장
//           await chrome.storage.local.set({ eCampusCookies: cookies });

//           // 필요한 응답 데이터 구성
//           const responseData = {
//             success: true,
//             cookies: cookies,
//             data: loginResponse.data,
//           };

//           // 탭 닫기
//           await chrome.tabs.remove(tab.id);

//           // 원래 요청에 응답
//           sendResponse(responseData);
//         } else {
//           // 로그인 실패 처리
//           await chrome.tabs.remove(tab.id);
//           sendResponse({
//             success: false,
//             error: "Login failed",
//             data: loginResponse,
//           });
//         }
//       }
//     );
//   } catch (error) {
//     console.error("Silent login error:", error);
//     sendResponse({ success: false, error: error.toString() });
//   }
// }

// // 쿠키 변경 감지 및 관리
// chrome.cookies.onChanged.addListener(({ cookie, removed }) => {
//   if (cookie.domain.includes("ecampus.konkuk.ac.kr")) {
//     // 쿠키 변경 시 storage 업데이트
//     chrome.cookies.getAll({ domain: "ecampus.konkuk.ac.kr" }, (cookies) => {
//       console.log("Updated cookies:", cookies);
//       chrome.storage.local.set({ eCampusCookies: cookies });
//     });
//   }
// });
