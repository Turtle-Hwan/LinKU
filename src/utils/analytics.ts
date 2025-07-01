// Google Analytics 4 (gtag) 설정
declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

const GA_MEASUREMENT_ID = "G-GX1NFBMFTW";

// Google Analytics 초기화
export const initGA = () => {
  // dataLayer 초기화
  window.dataLayer = window.dataLayer || [];

  // gtag 함수 정의
  window.gtag = function (...args: unknown[]) {
    window.dataLayer.push(args);
  };

  // Google Analytics 스크립트 동적 로드
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  // 초기 설정
  window.gtag("js", new Date());
  window.gtag("config", GA_MEASUREMENT_ID, {
    // 크롬 확장 프로그램용 설정
    send_page_view: false, // 자동 페이지뷰 전송 비활성화
    anonymize_ip: true, // IP 익명화
  });
};

// 페이지뷰 추적
export const trackPageView = (pageName: string) => {
  if (window.gtag) {
    window.gtag("event", "page_view", {
      page_title: pageName,
      page_location: `chrome-extension://${chrome.runtime.id}/${pageName}`,
    });
  }
};

// 이벤트 추적
export const trackEvent = (
  eventName: string,
  parameters?: Record<string, unknown>
) => {
  if (window.gtag) {
    window.gtag("event", eventName, {
      custom_parameter_1: "chrome_extension",
      ...parameters,
    });
  }
};

// 버튼 클릭 추적
export const trackButtonClick = (buttonName: string, url?: string) => {
  trackEvent("click", {
    event_category: "button",
    event_label: buttonName,
    value: url || buttonName,
  });
};

// 링크 클릭 추적
export const trackLinkClick = (linkName: string, url: string) => {
  trackEvent("click", {
    event_category: "external_link",
    event_label: linkName,
    value: url,
  });
};

// 탭 변경 추적
export const trackTabChange = (tabName: string) => {
  trackEvent("tab_change", {
    event_category: "navigation",
    event_label: tabName,
  });
};
