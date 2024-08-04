async function getCurrentTab() {
  let queryOptions = { active: true, lastFocusedWindow: true };
  let [tab] = await chrome.tabs.query(queryOptions);
  return tab;
}

function popup_dom() {
  return document;
}

chrome.runtime.onMessage.addListener((request, sender) => {
  if (request.action == "getSource") {
    //console.log("r.s : ", request.source);
    console.log("docu.b.i : ", document.body.innerHTML);
    console.log("request : ", request);

    const originPageDiv = document.querySelector("#origin-page");
    originPageDiv.innerHTML = request.source;
  }
});

//수강신청 업데이트 새로고침
function sugangRefreshBtn() {
  const refreshBtn = document.querySelectorAll(
    "#btnRefresh.btn-sm.btn-sub.btn-mode"
  );
  console.log("sugangRefresh Btn func : ", refreshBtn);

  refreshBtn.forEach((btn) => {
    btn.click();
  });
}

async function onWindowLoad() {
  let currentTab = await getCurrentTab();
  console.log("currenttab id", currentTab.id);
  chrome.scripting
    .executeScript({
      target: { tabId: currentTab.id, allFrames: true },
      files: ["getSource.js"],
    })
    .then((result) => {
      console.log("Injection Success", result);
    })
    .catch((err) => {
      console.log("err", err);
    });

  //
  //
  //
  const CErefreshBtn = document.getElementById("refresh-btn");
  CErefreshBtn.addEventListener("click", () => {
    console.log(currentTab.id);
    chrome.scripting
      .executeScript({
        target: { tabId: currentTab.id, allFrames: true },
        // files: ["content-script.js"],
        // files: ["sugangRefresh.js"],
        func: sugangRefreshBtn,
      })
      .then((result) => {
        console.log("Injection Success", result);
      })
      .catch((err) => {
        console.log("err", err);
      });
  });
}

//window.onload = onWindowLoad;

onWindowLoad();
