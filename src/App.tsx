import { useEffect } from "react";
import {
  getCurrentTab,
  executeScript,
  executeScriptFile,
} from "./utils/chrome";
import { sugangRefreshBtn } from "./utils/sugang";
import "./App.css";
import Link from "./components/Link";

function App() {
  useEffect(() => {
    async function initializeExtension() {
      const currentTab = await getCurrentTab();
      if (!currentTab.id) return;

      await executeScriptFile(currentTab.id, ["getSource.js"]);

      const refreshButton = document.getElementById("refresh-btn");
      refreshButton?.addEventListener("click", async () => {
        await executeScript(currentTab.id!, sugangRefreshBtn);
      });
    }

    initializeExtension();
  }, []);

  return (
    <>
      <button id="refresh-btn">Refresh</button>
      <Link />
    </>
  );
}

export default App;
