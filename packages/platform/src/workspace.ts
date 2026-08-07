export type WorkspaceLocale = "ko" | "en";

export interface WorkspaceLocalizedText {
  ko: string;
  en: string;
}

export type WorkspaceIconName =
  | "University"
  | "BellRing"
  | "MonitorPlay"
  | "Trophy"
  | "Clock3"
  | "MapPinned"
  | "GraduationCap"
  | "BookCopy"
  | "CalendarDays"
  | "Utensils"
  | "AlarmClock"
  | "UsersRound"
  | "BedDouble"
  | "MessagesSquare"
  | "ScrollText"
  | "Building2"
  | "Lightbulb"
  | "Library";

export const WORKSPACE_ICON_NAMES: readonly WorkspaceIconName[] = [
  "University",
  "BellRing",
  "MonitorPlay",
  "Trophy",
  "Clock3",
  "MapPinned",
  "GraduationCap",
  "BookCopy",
  "CalendarDays",
  "Utensils",
  "AlarmClock",
  "UsersRound",
  "BedDouble",
  "MessagesSquare",
  "ScrollText",
  "Building2",
  "Lightbulb",
  "Library",
];

export interface WorkspaceQuickLinkAction {
  id: string;
  label: WorkspaceLocalizedText;
  href: string;
  recommendedFor?: "web" | "extension";
}

export interface WorkspaceQuickLink {
  id: string;
  icon: WorkspaceIconName;
  title: WorkspaceLocalizedText;
  description: WorkspaceLocalizedText;
  href: string;
  category: "study" | "admin" | "life";
  wide?: boolean;
  actions?: WorkspaceQuickLinkAction[];
}

export interface WorkspaceTemplatePreset {
  id: string;
  title: WorkspaceLocalizedText;
  description: WorkspaceLocalizedText;
  shortcutIds: string[];
}

export interface WorkspaceCustomShortcut {
  id: string;
  name: string;
  href: string;
  icon: WorkspaceIconName;
  wide?: boolean;
}

export const WORKSPACE_QUICK_LINKS: WorkspaceQuickLink[] = [
  {
    id: "konkuk-home",
    icon: "University",
      title: { ko: "홈페이지", en: "Konkuk Home" },
    description: {
      ko: "학교 공지와 대표 서비스를 가장 먼저 여는 기본 진입점",
      en: "The main campus entry point for official announcements and services",
    },
    href: "https://www.konkuk.ac.kr/konkuk/index.do",
    category: "admin",
    actions: [
      {
        id: "software-rental",
        label: { ko: "상용 SW 무료 대여", en: "Software rental" },
        href: "https://www.konkuk.ac.kr/kuinc/15905/subview.do",
      },
    ],
  },
  {
    id: "alerts",
    icon: "BellRing",
    title: { ko: "공지사항", en: "Alerts" },
    description: {
      ko: "학사, 학생, 일반 공지를 빠르게 훑어보는 경로",
      en: "A fast path to official academic and student notices",
    },
    href: "https://www.konkuk.ac.kr/konkuk/2238/subview.do",
    category: "admin",
  },
  {
    id: "ecampus",
    icon: "MonitorPlay",
    title: { ko: "eCampus", en: "eCampus" },
    description: {
      ko: "강의 자료, 과제, 공지 확인을 위한 학습 허브",
      en: "The learning hub for lectures, assignments, and course notices",
    },
    href: "https://ecampus.konkuk.ac.kr",
    category: "study",
  },
  {
    id: "wein",
    icon: "Trophy",
    title: { ko: "위인전", en: "WEIN" },
    description: {
      ko: "비교과 활동과 K-Cube 흐름을 자주 보는 학생용 경로",
      en: "A shortcut for extra-curricular activity and K-Cube workflows",
    },
    href: "https://wein.konkuk.ac.kr",
    category: "study",
    actions: [
      {
        id: "k-cube",
        label: { ko: "K-Cube 대여", en: "Reserve K-Cube" },
        href: "https://wein.konkuk.ac.kr/ptfol/cmnt/cube/findCubeResveStep1.do",
      },
    ],
  },
  {
    id: "course-registration",
    icon: "Clock3",
    title: { ko: "수강신청", en: "Course registration" },
    description: {
      ko: "수강신청과 관련 공지를 빠르게 넘나드는 경로",
      en: "A direct entry for registration and related updates",
    },
    href: "https://sugang.konkuk.ac.kr",
    category: "admin",
    actions: [
      {
        id: "course-registration-guide",
        label: { ko: "추가 신청서", en: "Add/drop form" },
        href: "https://www.konkuk.ac.kr/konkuk/2088/subview.do?enc=Zm5jdDF8QEB8JTJGYmJzJTJGa29ua3VrJTJGMjQ3JTJGOTM0OTIyJTJGYXJ0Y2xWaWV3LmRvJTNGcGFnZSUzRDElMjZzcmNoQ29sdW1uJTNEc2olMjZzcmNoV3JkJTNEJUVDJUI0JTg4JUVBJUIzJUJDKyVFQSVCNSU5MCVFQSVCMyVCQyVFQiVBQSVBOSslRUMlQjYlOTQlRUElQjAlODAlMjZiYnNDbFNlcSUzRDEzOTQlMjZiYnNPcGVuV3JkU2VxJTNEJTI2cmdzQmduZGVTdHIlM0QlMjZyZ3NFbmRkZVN0ciUzRCUyNmlzVmlld01pbmUlM0RmYWxzZSUyNnBhc3N3b3JkJTNEJTI2",
      },
    ],
  },
  {
    id: "campus-map",
    icon: "MapPinned",
    title: { ko: "캠퍼스맵", en: "Campus map" },
    description: {
      ko: "강의실과 건물 위치를 확인하는 생활형 경로",
      en: "The map view for buildings and classroom locations",
    },
    href: "https://research.konkuk.ac.kr/campusMap/konkuk/view.do#this",
    category: "life",
  },
  {
    id: "kuis",
    icon: "GraduationCap",
    title: { ko: "학사정보시스템", en: "Academic portal" },
    description: {
      ko: "성적, 졸업, 행정 처리를 모아보는 통합 포털",
      en: "The unified academic portal for grades, credits, and administration",
    },
    href: "https://kuis.konkuk.ac.kr/index.do",
    category: "admin",
    wide: true,
  },
  {
    id: "library",
    icon: "Library",
    title: { ko: "상허기념도서관", en: "Library" },
    description: {
      ko: "도서관 좌석과 자료 검색의 기본 진입점",
      en: "The base entry for library seats and resource lookup",
    },
    href: "https://library.konkuk.ac.kr/",
    category: "study",
    wide: true,
  },
  {
    id: "academic-calendar",
    icon: "CalendarDays",
    title: { ko: "학사일정", en: "Academic calendar" },
    description: {
      ko: "수강, 시험, 정정 기간을 놓치지 않기 위한 일정 확인",
      en: "Official calendar pages for deadlines and semester milestones",
    },
    href: "https://www.konkuk.ac.kr/konkuk/2161/subview.do",
    category: "admin",
  },
  {
    id: "cafeteria",
    icon: "Utensils",
    title: { ko: "학식 메뉴", en: "Cafeteria menu" },
    description: {
      ko: "학교 식당 메뉴를 확인하는 생활형 링크",
      en: "A quick check-in path for campus dining menus",
    },
    href: "https://www.konkuk.ac.kr/general/18211/subview.do",
    category: "life",
  },
  {
    id: "everytime",
    icon: "AlarmClock",
    title: { ko: "에브리타임", en: "Everytime" },
    description: {
      ko: "학내 커뮤니티로 넘어가는 외부 서비스 링크",
      en: "The common handoff to a widely used student community service",
    },
    href: "https://account.everytime.kr/login",
    category: "life",
  },
  {
    id: "department-info",
    icon: "UsersRound",
    title: { ko: "학과 정보", en: "Department info" },
    description: {
      ko: "전공별 안내와 학과별 공지를 찾는 경로",
      en: "A directory for department-specific information and notices",
    },
    href: "https://www.konkuk.ac.kr/konkuk/2143/subview.do",
    category: "study",
  },
  {
    id: "kulhouse",
    icon: "BedDouble",
    title: { ko: "쿨하우스", en: "KUL House" },
    description: {
      ko: "기숙사 생활 관련 정보를 여는 경로",
      en: "The housing portal for dormitory-related information",
    },
    href: "https://kulhouse.konkuk.ac.kr",
    category: "life",
  },
  {
    id: "kung",
    icon: "MessagesSquare",
    title: { ko: "KUNG", en: "KUNG" },
    description: {
      ko: "학생 커뮤니티 및 학교 생활 정보 링크",
      en: "A community-oriented shortcut for student life information",
    },
    href: "https://kung.kr/",
    category: "life",
  },
  {
    id: "bulletin-2025",
    icon: "ScrollText",
    title: { ko: "2025 요람", en: "2025 bulletin" },
    description: {
      ko: "학교 공식 요람과 전반적 안내를 확인하는 경로",
      en: "The official 2025 bulletin for broad academic reference",
    },
    href: "https://www.konkuk.ac.kr/sites/bulletins25/index.do",
    category: "admin",
  },
  {
    id: "field-practice",
    icon: "Building2",
    title: { ko: "현장실습", en: "Field practice" },
    description: {
      ko: "현장실습 관련 공지와 신청을 위한 서비스 경로",
      en: "A field-practice workflow link for internship-related steps",
    },
    href: "https://field.konkuk.ac.kr/index.do",
    category: "study",
  },
  {
    id: "startup",
    icon: "Lightbulb",
    title: { ko: "창업지원", en: "Startup support" },
    description: {
      ko: "창업 지원 프로그램과 공지를 보는 링크",
      en: "A shortcut for startup support programs and updates",
    },
    href: "https://startup.konkuk.ac.kr",
    category: "study",
  },
];

export const DEFAULT_WORKSPACE_TEMPLATE: WorkspaceTemplatePreset = {
  id: "default-campus",
  title: { ko: "LinKU 기본 템플릿", en: "LinKU default template" },
  description: {
    ko: "extension의 기본 빠른 진입 구성을 그대로 옮긴 캠퍼스 기본형",
    en: "The base campus setup that mirrors the extension's default quick-access layout",
  },
  shortcutIds: WORKSPACE_QUICK_LINKS.map((item) => item.id),
};

export const WORKSPACE_TEMPLATE_PRESETS: WorkspaceTemplatePreset[] = [
  DEFAULT_WORKSPACE_TEMPLATE,
  {
    id: "class-focus",
    title: { ko: "수업 집중형", en: "Class focus" },
    description: {
      ko: "eCampus, 도서관, 학사 일정 중심으로 구성한 학습형 묶음",
      en: "A study-first bundle centered on eCampus, library, and calendar access",
    },
    shortcutIds: [
      "ecampus",
      "library",
      "academic-calendar",
      "kuis",
      "department-info",
      "alerts",
      "course-registration",
      "field-practice",
    ],
  },
  {
    id: "semester-admin",
    title: { ko: "학기 행정형", en: "Semester admin" },
    description: {
      ko: "수강, 학사 포털, 공지, 행정 동선을 빠르게 모은 구성",
      en: "A setup for course registration, academic portal work, and admin alerts",
    },
    shortcutIds: [
      "alerts",
      "course-registration",
      "kuis",
      "academic-calendar",
      "konkuk-home",
      "wein",
      "field-practice",
      "startup",
    ],
  },
  {
    id: "daily-life",
    title: { ko: "생활 밀착형", en: "Daily life" },
    description: {
      ko: "식단, 지도, 기숙사, 커뮤니티를 가까이에 둔 생활형 묶음",
      en: "A daily-life bundle for dining, maps, housing, and community links",
    },
    shortcutIds: [
      "campus-map",
      "cafeteria",
      "kulhouse",
      "everytime",
      "kung",
      "department-info",
      "konkuk-home",
      "alerts",
    ],
  },
  {
    id: "career-builder",
    title: { ko: "커리어 준비형", en: "Career builder" },
    description: {
      ko: "위인전, 현장실습, 창업지원, 도서관을 묶은 성장형 구성",
      en: "A career-oriented set built around WEIN, internships, startup support, and the library",
    },
    shortcutIds: [
      "wein",
      "field-practice",
      "startup",
      "library",
      "ecampus",
      "alerts",
      "department-info",
      "bulletin-2025",
    ],
  },
];

export const WORKSPACE_ALERT_CATEGORIES = [
  {
    id: "all",
    label: { ko: "전체", en: "All" },
  },
  {
    id: "학사",
    label: { ko: "학사", en: "Academic" },
  },
  {
    id: "학생",
    label: { ko: "학생", en: "Student" },
  },
  {
    id: "일반",
    label: { ko: "일반", en: "General" },
  },
  {
    id: "국제",
    label: { ko: "국제", en: "Global" },
  },
  {
    id: "장학",
    label: { ko: "장학", en: "Scholarship" },
  },
  {
    id: "취창업",
    label: { ko: "취창업", en: "Career" },
  },
] as const;

export function getWorkspaceQuickLink(id: string) {
  return WORKSPACE_QUICK_LINKS.find((item) => item.id === id);
}

export function localizeWorkspaceText(
  value: WorkspaceLocalizedText,
  locale: WorkspaceLocale,
) {
  return value[locale];
}
