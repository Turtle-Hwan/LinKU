import type { AppLocale } from "@/i18n/routing";

const copy = {
  intro: {
    eyebrow: {
      ko: "LinKU Web Intro",
      en: "LinKU Web Intro",
    },
    title: {
      ko: "이제 web에서도 extension의 핵심 흐름을 그대로 씁니다.",
      en: "The web app now carries the extension's core workflow too.",
    },
    body: {
      ko: "LinKU web은 더 이상 설치 안내와 로그인 진입만 담당하지 않습니다. 빠른 학교 바로가기, 공지 확인, Todo 흐름, 템플릿 선택과 갤러리까지 한 화면 안에서 extension과 같은 제품 경험을 이어가도록 정리했습니다.",
      en: "LinKU web no longer stops at install guidance and login. It now continues the same product experience as the extension across shortcuts, alerts, task flow, and template browsing.",
    },
    sections: {
      ko: [
        {
          title: "빠른 진입",
          body: "건국대 주요 서비스 바로가기를 웹에서도 같은 카탈로그로 제공합니다. extension에서 익숙한 기본 템플릿을 웹 대시보드에서도 그대로 적용할 수 있습니다.",
        },
        {
          title: "알림과 Todo",
          body: "공지 피드와 개인 Todo 흐름을 한곳에서 확인하도록 정리했습니다. 웹 환경에서는 브라우저 친화적인 방식으로 알림 필터와 eCampus 즉시 조회를 제공합니다.",
        },
        {
          title: "템플릿 편집",
          body: "템플릿을 고르고, 복제하고, 편집하고, 갤러리에서 다른 구성을 가져오는 흐름을 웹에서도 이어서 사용할 수 있습니다.",
        },
      ],
      en: [
        {
          title: "Quick access",
          body: "The same Konkuk shortcut catalog now lives on the web, and the dashboard can apply the same default template you use in the extension.",
        },
        {
          title: "Alerts and todos",
          body: "Alerts and personal task flow are now organized in one place, with browser-friendly filtering and on-demand eCampus fetching for the web.",
        },
        {
          title: "Template editing",
          body: "You can browse, clone, edit, and apply shortcut templates from the web without leaving the single LinKU domain.",
        },
      ],
    },
    ctaDashboard: {
      ko: "대시보드 열기",
      en: "Open dashboard",
    },
    ctaInstall: {
      ko: "extension 설치",
      en: "Install extension",
    },
  },
  workspace: {
    heroEyebrow: {
      ko: "Extension parity workspace",
      en: "Extension parity workspace",
    },
    heroTitle: {
      ko: "extension에서 하던 흐름을 web에서도 바로 이어가세요.",
      en: "Continue the same extension flow directly on the web.",
    },
    heroBody: {
      ko: "빠른 학교 진입, 공지 모아보기, Todo 관리, 템플릿 적용과 갤러리 탐색까지 한 화면에서 묶었습니다.",
      en: "Shortcuts, alerts, todo flow, template selection, and gallery browsing now live together in one web workspace.",
    },
    openIntro: {
      ko: "소개 보기",
      en: "Read intro",
    },
    openTemplates: {
      ko: "템플릿 관리",
      en: "Manage templates",
    },
    openGallery: {
      ko: "갤러리 보기",
      en: "Open gallery",
    },
    tabs: {
      shortcuts: { ko: "바로가기", en: "Shortcuts" },
      alerts: { ko: "알림", en: "Alerts" },
      todos: { ko: "Todo", en: "Todos" },
      templates: { ko: "템플릿", en: "Templates" },
    },
    searchPlaceholder: {
      ko: "건국대 통합 검색어 입력",
      en: "Search Konkuk services",
    },
    searchAction: {
      ko: "검색",
      en: "Search",
    },
  },
  alerts: {
    title: {
      ko: "공지 피드",
      en: "Alert feed",
    },
    description: {
      ko: "extension의 알림 흐름을 web 친화적으로 옮겼습니다. 전체 공지와 내가 보는 카테고리를 나눠서 볼 수 있습니다.",
      en: "The extension alert flow is now available in a web-friendly view, with all notices and followed categories separated.",
    },
    all: {
      ko: "전체 공지",
      en: "All alerts",
    },
    followed: {
      ko: "내 카테고리",
      en: "Followed",
    },
    empty: {
      ko: "표시할 공지가 없습니다.",
      en: "There are no alerts to show.",
    },
    loading: {
      ko: "공지를 불러오는 중입니다.",
      en: "Loading alerts.",
    },
    follow: {
      ko: "팔로우",
      en: "Follow",
    },
    unfollow: {
      ko: "해제",
      en: "Unfollow",
    },
    updatedAtPrefix: {
      ko: "게시일",
      en: "Posted",
    },
  },
  todos: {
    title: {
      ko: "Todo 흐름",
      en: "Todo flow",
    },
    description: {
      ko: "개인 Todo는 브라우저에 저장하고, eCampus Todo는 필요할 때 즉시 가져옵니다.",
      en: "Personal todos stay in the browser, while eCampus todos are fetched on demand.",
    },
    addTitlePlaceholder: {
      ko: "할 일 제목",
      en: "Todo title",
    },
    addDateLabel: {
      ko: "마감일",
      en: "Due date",
    },
    addButton: {
      ko: "추가",
      en: "Add",
    },
    syncButton: {
      ko: "eCampus 불러오기",
      en: "Fetch eCampus todos",
    },
    syncDialogTitle: {
      ko: "eCampus Todo 불러오기",
      en: "Load eCampus todos",
    },
    syncDialogBody: {
      ko: "웹에서는 브라우저 확장 권한 대신 서버 프록시를 통해 즉시 Todo를 가져옵니다. 자격 증명은 요청 처리 후 저장하지 않습니다.",
      en: "On the web, eCampus todos are loaded through a server proxy instead of extension permissions. Credentials are not stored after the request.",
    },
    studentId: {
      ko: "학번 또는 ID",
      en: "Student ID",
    },
    password: {
      ko: "비밀번호",
      en: "Password",
    },
    fetchNow: {
      ko: "지금 불러오기",
      en: "Fetch now",
    },
    empty: {
      ko: "아직 Todo가 없습니다.",
      en: "There are no todos yet.",
    },
    remove: {
      ko: "삭제",
      en: "Remove",
    },
    markDone: {
      ko: "완료",
      en: "Done",
    },
    markUndone: {
      ko: "미완료",
      en: "Undo",
    },
    ecampusBadge: {
      ko: "eCampus",
      en: "eCampus",
    },
    personalBadge: {
      ko: "개인",
      en: "Personal",
    },
  },
  templates: {
    title: {
      ko: "템플릿",
      en: "Templates",
    },
    description: {
      ko: "extension의 빠른 링크 구성을 web에서도 고르고 저장하고 적용할 수 있습니다.",
      en: "The same shortcut layouts can now be selected, saved, and applied on the web.",
    },
    activeBadge: {
      ko: "현재 적용 중",
      en: "Active",
    },
    defaultBadge: {
      ko: "기본",
      en: "Default",
    },
    galleryBadge: {
      ko: "갤러리",
      en: "Gallery",
    },
    createEmpty: {
      ko: "빈 템플릿 만들기",
      en: "Create empty template",
    },
    createDefault: {
      ko: "기본 템플릿에서 시작",
      en: "Start from default",
    },
    apply: {
      ko: "적용",
      en: "Apply",
    },
    edit: {
      ko: "편집",
      en: "Edit",
    },
    duplicate: {
      ko: "복제",
      en: "Duplicate",
    },
    remove: {
      ko: "삭제",
      en: "Delete",
    },
    empty: {
      ko: "아직 저장한 템플릿이 없습니다.",
      en: "No saved templates yet.",
    },
    editorTitleNew: {
      ko: "새 템플릿 만들기",
      en: "Create a new template",
    },
    editorTitleEdit: {
      ko: "템플릿 편집",
      en: "Edit template",
    },
    editorName: {
      ko: "템플릿 이름",
      en: "Template name",
    },
    editorDescription: {
      ko: "설명",
      en: "Description",
    },
    editorSave: {
      ko: "저장",
      en: "Save",
    },
    editorSaveAndApply: {
      ko: "저장 후 적용",
      en: "Save and apply",
    },
    editorCancel: {
      ko: "취소",
      en: "Cancel",
    },
    availableShortcuts: {
      ko: "추가 가능한 바로가기",
      en: "Available shortcuts",
    },
    selectedShortcuts: {
      ko: "선택한 바로가기",
      en: "Selected shortcuts",
    },
    moveUp: {
      ko: "위로",
      en: "Up",
    },
    moveDown: {
      ko: "아래로",
      en: "Down",
    },
    addShortcut: {
      ko: "추가",
      en: "Add",
    },
    removeShortcut: {
      ko: "빼기",
      en: "Remove",
    },
    galleryTitle: {
      ko: "공개 갤러리",
      en: "Template gallery",
    },
    galleryDescription: {
      ko: "extension에서 보던 갤러리 흐름을 web용 큐레이션으로 옮겼습니다. 마음에 드는 구성을 복제해 바로 적용할 수 있습니다.",
      en: "The extension gallery flow is carried to the web with curated setups that you can clone and apply.",
    },
    clonePreset: {
      ko: "이 구성 복제",
      en: "Clone this preset",
    },
  },
};

export function getWorkspaceCopy(locale: AppLocale) {
  return {
    intro: {
      eyebrow: copy.intro.eyebrow[locale],
      title: copy.intro.title[locale],
      body: copy.intro.body[locale],
      sections: copy.intro.sections[locale],
      ctaDashboard: copy.intro.ctaDashboard[locale],
      ctaInstall: copy.intro.ctaInstall[locale],
    },
    workspace: {
      heroEyebrow: copy.workspace.heroEyebrow[locale],
      heroTitle: copy.workspace.heroTitle[locale],
      heroBody: copy.workspace.heroBody[locale],
      openIntro: copy.workspace.openIntro[locale],
      openTemplates: copy.workspace.openTemplates[locale],
      openGallery: copy.workspace.openGallery[locale],
      tabs: {
        shortcuts: copy.workspace.tabs.shortcuts[locale],
        alerts: copy.workspace.tabs.alerts[locale],
        todos: copy.workspace.tabs.todos[locale],
        templates: copy.workspace.tabs.templates[locale],
      },
      searchPlaceholder: copy.workspace.searchPlaceholder[locale],
      searchAction: copy.workspace.searchAction[locale],
    },
    alerts: Object.fromEntries(
      Object.entries(copy.alerts).map(([key, value]) => [key, value[locale]]),
    ) as Record<keyof typeof copy.alerts, string>,
    todos: Object.fromEntries(
      Object.entries(copy.todos).map(([key, value]) => [key, value[locale]]),
    ) as Record<keyof typeof copy.todos, string>,
    templates: Object.fromEntries(
      Object.entries(copy.templates).map(([key, value]) => [key, value[locale]]),
    ) as Record<keyof typeof copy.templates, string>,
  };
}
