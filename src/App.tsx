import { useState, useEffect } from "react";

declare const chrome: any;
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";

async function getCurrentTab() {
  const queryOptions = { active: true, lastFocusedWindow: true };
  const [tab] = await chrome.tabs.query(queryOptions);
  return tab;
}

function sugangRefreshBtn() {
  const refreshBtn = document.querySelectorAll(
    "#btnRefresh.btn-sm.btn-sub.btn-mode"
  );
  console.log("sugangRefresh Btn func : ", refreshBtn);

  refreshBtn.forEach((btn) => {
    (btn as HTMLButtonElement).click();
  });
}

function App() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    async function onWindowLoad() {
      const currentTab = await getCurrentTab();
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

      const CErefreshBtn = document.getElementById("refresh-btn");
      CErefreshBtn?.addEventListener("click", () => {
        console.log(currentTab.id);
        chrome.scripting
          .executeScript({
            target: { tabId: currentTab.id, allFrames: true },
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

    onWindowLoad();
  }, []);

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
      <button id="refresh-btn">Refresh</button>
    </>
  );
}

export default App;
