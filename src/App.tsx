import { useEffect } from "react";
import "./App.css";
import MainLayout from "./components/MainLayout";
import TabsLayout from "./components/TabsLayout";
import { Toaster } from "./components/ui/sonner";
import { sendPageView } from "./utils/analytics";

function App() {
  console.log(
    "%c여길 열어보시다니...\n이 참에 직접 코드 기여도 해주시는 건 어떤가요?",
    "font-family: Nanum Gothic; color: darkgreen; padding: 6px; border-radius: 4px; font-size:14px"
  );
  console.log("https://github.com/Turtle-Hwan/LinKU");

  // Google Analytics: Extension 열릴 때 페이지뷰 전송
  useEffect(() => {
    sendPageView("LinKU Extension - Popup", "chrome-extension://linku/popup");
  }, []);

  return (
    <>
      <MainLayout>
        <TabsLayout />
      </MainLayout>
      <Toaster />
    </>
  );
}

export default App;
