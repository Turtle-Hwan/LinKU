import { useEffect } from "react";
import "./App.css";
import { ErrorBoundary } from "react-error-boundary";
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
    <ErrorBoundary
      fallback={
        <div className="w-[500px] h-[600px] flex items-center justify-center p-8">
          <div className="text-center space-y-4">
            <h2 className="text-xl font-semibold text-destructive">
              오류가 발생했습니다
            </h2>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              새로고침
            </button>
          </div>
        </div>
      }
    >
      <MainLayout>
        <TabsLayout />
      </MainLayout>
      <Toaster duration={2000} />
    </ErrorBoundary>
  );
}

export default App;
