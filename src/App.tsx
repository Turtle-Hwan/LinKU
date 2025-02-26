// import { useEffect } from "react";
// import {
//   getCurrentTab,
//   executeScript,
//   // executeScriptFile,
// } from "./utils/chrome";
// import { sugangRefreshBtn } from "./utils/sugang";
import "./App.css";
import LinkGroup from "./components/LinkGroup";

function App() {
  // useEffect(() => {
  //   async function initializeExtension() {
  //     const currentTab = await getCurrentTab();
  //     if (!currentTab.id) return;

  //     // await executeScriptFile(currentTab.id, ["getSource.js"]);

  //     const refreshButton = document.getElementById("refresh-btn");
  //     refreshButton?.addEventListener("click", async () => {
  //       await executeScript(currentTab.id!, sugangRefreshBtn);
  //     });
  //   }

  //   initializeExtension();
  // }, []);

  console.log(
    "%c여길 열어보시다니...\n이 참에 직접 코드 기여도 해주시는 건 어떤가요?",
    "font-family: Nanum Gothic; color: darkgreen; padding: 6px; border-radius: 4px; font-size:14px"
  );
  console.log("https://github.com/Turtle-Hwan/LinKU");

  return (
    <>
      {/* <button id="refresh-btn">Refresh</button> */}
      <LinkGroup />
    </>
  );
}

export default App;
