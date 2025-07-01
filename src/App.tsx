import "./App.css";
import { useEffect } from "react";
import { initGA, trackPageView } from "./utils/analytics";
import MainLayout from "./components/MainLayout";
import TabsLayout from "./components/TabsLayout";

function App() {
  useEffect(() => {
    // Google Analytics 초기화
    initGA();

    // 페이지뷰 추적
    trackPageView('popup');
  }, []);

  console.log(
    "%c여길 열어보시다니...\n이 참에 직접 코드 기여도 해주시는 건 어떤가요?",
    "font-family: Nanum Gothic; color: darkgreen; padding: 6px; border-radius: 4px; font-size:14px"
  );
  console.log("https://github.com/Turtle-Hwan/LinKU");

  return (
    <>
      <MainLayout>
        <TabsLayout />
      </MainLayout>
    </>
  );
}

export default App;
