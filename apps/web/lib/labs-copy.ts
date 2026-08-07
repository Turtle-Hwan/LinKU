import type { AppLocale } from "@/i18n/routing";

const copy = {
  page: {
    eyebrow: {
      ko: "Labs",
      en: "Labs",
    },
    title: {
      ko: "필요할 때 꺼내 쓰는 작은 도구",
      en: "Small tools, ready when you need them",
    },
    body: {
      ko: "도서관 좌석 확인, 서버 시계, QR 생성기를 한곳에서 사용할 수 있습니다.",
      en: "Check library seats, sync a server clock, or create a QR code in one place.",
    },
  },
  library: {
    title: {
      ko: "도서관 좌석 현황",
      en: "Library seats",
    },
    description: {
      ko: "저장된 eCampus 계정이나 즉시 입력한 계정으로 도서관 좌석 현황을 확인합니다.",
      en: "Check library seat availability using saved or one-time eCampus credentials.",
    },
    studentId: {
      ko: "학번 또는 ID",
      en: "Student ID",
    },
    password: {
      ko: "비밀번호",
      en: "Password",
    },
    fetch: {
      ko: "좌석 불러오기",
      en: "Load seats",
    },
    refresh: {
      ko: "새로고침",
      en: "Refresh",
    },
    reserve: {
      ko: "예약 페이지 열기",
      en: "Open reservation",
    },
    usingSaved: {
      ko: "저장된 eCampus 계정을 사용해 자동으로 조회할 수 있습니다.",
      en: "Saved eCampus credentials can be used automatically here.",
    },
    noCredentials: {
      ko: "저장된 계정이 없으면 아래에서 한 번 입력해 바로 조회할 수 있습니다.",
      en: "If nothing is saved yet, enter credentials below for a one-time check.",
    },
    empty: {
      ko: "표시할 열람실 정보가 아직 없습니다.",
      en: "No library rooms are available to display yet.",
    },
    available: {
      ko: "여석",
      en: "available",
    },
    updatedAt: {
      ko: "마지막 갱신",
      en: "Last updated",
    },
    saveHint: {
      ko: "반복해서 쓸 계정은 설정 페이지에서 브라우저에 암호화해 저장할 수 있습니다.",
      en: "Save frequently used credentials in Settings with browser-side encryption.",
    },
  },
  clock: {
    title: {
      ko: "서버 시계",
      en: "Server clock",
    },
    description: {
      ko: "수강신청 같은 민감한 시점에 대비해 건국대 HTTPS 서버의 Date 헤더 기준 시간을 확인합니다.",
      en: "Check a Konkuk HTTPS server's Date header when timing matters.",
    },
    inputLabel: {
      ko: "대상 URL",
      en: "Target URL",
    },
    apply: {
      ko: "적용",
      en: "Apply",
    },
    refresh: {
      ko: "다시 동기화",
      en: "Resync",
    },
    currentTime: {
      ko: "현재 서버 시각",
      en: "Current server time",
    },
    lastSync: {
      ko: "마지막 동기화",
      en: "Last sync",
    },
    roundTrip: {
      ko: "왕복 지연",
      en: "Round trip",
    },
  },
  qr: {
    title: {
      ko: "QR 생성기",
      en: "QR generator",
    },
    description: {
      ko: "URL이나 간단한 텍스트를 붙여 넣고 바로 QR 이미지로 내려받습니다.",
      en: "Turn a URL or short text into a downloadable QR image.",
    },
    inputLabel: {
      ko: "텍스트 또는 URL",
      en: "Text or URL",
    },
    placeholder: {
      ko: "https://example.com",
      en: "https://example.com",
    },
    generate: {
      ko: "QR 생성",
      en: "Generate QR",
    },
    download: {
      ko: "PNG 내려받기",
      en: "Download PNG",
    },
    empty: {
      ko: "입력값을 넣으면 여기에서 QR을 미리 볼 수 있습니다.",
      en: "Enter a value to preview the QR code here.",
    },
  },
  settings: {
    credentialsTitle: {
      ko: "eCampus 계정 저장",
      en: "Save eCampus credentials",
    },
    credentialsBody: {
      ko: "Todo 불러오기와 도서관 좌석 조회에 쓸 계정을 브라우저에 암호화해 저장합니다.",
      en: "Store credentials with browser-side encryption for todos and library seat checks.",
    },
    save: {
      ko: "계정 저장",
      en: "Save credentials",
    },
    clear: {
      ko: "저장 삭제",
      en: "Clear saved credentials",
    },
    saved: {
      ko: "eCampus 계정을 브라우저에 저장했습니다.",
      en: "Saved eCampus credentials in the browser.",
    },
    cleared: {
      ko: "저장된 eCampus 계정을 삭제했습니다.",
      en: "Cleared saved eCampus credentials.",
    },
    openLabs: {
      ko: "Labs 열기",
      en: "Open Labs",
    },
  },
  timetable: {
    title: {
      ko: "시간표",
      en: "Timetable",
    },
    body: {
      ko: "시간표 기능은 준비 중입니다.",
      en: "The timetable feature is coming later.",
    },
  },
} as const;

function pickLocaleValue<T extends Record<AppLocale, string>>(value: T, locale: AppLocale) {
  return value[locale];
}

export function getLabsCopy(locale: AppLocale) {
  return {
    page: {
      eyebrow: pickLocaleValue(copy.page.eyebrow, locale),
      title: pickLocaleValue(copy.page.title, locale),
      body: pickLocaleValue(copy.page.body, locale),
    },
    library: Object.fromEntries(
      Object.entries(copy.library).map(([key, value]) => [key, pickLocaleValue(value, locale)]),
    ) as Record<keyof typeof copy.library, string>,
    clock: Object.fromEntries(
      Object.entries(copy.clock).map(([key, value]) => [key, pickLocaleValue(value, locale)]),
    ) as Record<keyof typeof copy.clock, string>,
    qr: Object.fromEntries(
      Object.entries(copy.qr).map(([key, value]) => [key, pickLocaleValue(value, locale)]),
    ) as Record<keyof typeof copy.qr, string>,
    settings: Object.fromEntries(
      Object.entries(copy.settings).map(([key, value]) => [key, pickLocaleValue(value, locale)]),
    ) as Record<keyof typeof copy.settings, string>,
    timetable: {
      title: pickLocaleValue(copy.timetable.title, locale),
      body: pickLocaleValue(copy.timetable.body, locale),
    },
  };
}
