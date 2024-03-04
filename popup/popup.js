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
    document.body.innerHTML = request.source;
  }
});

async function onWindowLoad() {
  let currentTab = await getCurrentTab();
  console.log("currenttab id", currentTab.id);
  chrome.scripting.executeScript({
      target : {tabId : currentTab.id, allFrames : true},
      files : [ "getSource.js" ],
    })
    .then((result) => {
      console.log("Injection Success", result);
    })
    .catch((err) => {
      console.log("err", err);
    });
}

//window.onload = onWindowLoad;

onWindowLoad();



/*
function test() {
    let ele = document.querySelectorAll("#btnRefresh.btn-sm.btn-sub.btn-mode");

    ele.forEach((btn) => {
        btn.click();
    })
}
*/