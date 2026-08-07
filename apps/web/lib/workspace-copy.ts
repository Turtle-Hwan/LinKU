import type { AppLocale } from "@/i18n/routing";

const copy = {
  intro: {
    eyebrow: {
      ko: "LinKU 한눈에 보기",
      en: "Meet LinKU",
    },
    title: {
      ko: "학교 생활에 필요한 것을 한곳에 모았습니다.",
      en: "Everything you need for campus, brought together.",
    },
    body: {
      ko: "학교 서비스 바로가기, 공지, Todo, 템플릿을 LinKU에서 함께 확인하고 내 방식대로 정리할 수 있습니다.",
      en: "Use campus shortcuts, alerts, todos, and templates together, then organize LinKU around your routine.",
    },
    sections: {
      ko: [
        {
          title: "빠른 진입",
          body: "eCampus, 학사정보, 도서관 등 자주 쓰는 학교 서비스를 바로 열고 내 링크도 함께 정리합니다.",
        },
        {
          title: "알림과 Todo",
          body: "학교 공지와 과제, 개인 Todo를 한곳에서 확인하고 지금 필요한 일부터 처리합니다.",
        },
        {
          title: "템플릿 편집",
          body: "기본 구성을 고르거나 갤러리에서 마음에 드는 템플릿을 가져와 내 방식대로 바꿉니다.",
        },
      ],
      en: [
        {
          title: "Quick access",
          body: "Open eCampus, the academic portal, and library services, then keep your own links beside them.",
        },
        {
          title: "Alerts and todos",
          body: "Review campus notices, assignments, and personal todos together and focus on what is next.",
        },
        {
          title: "Template editing",
          body: "Choose a starter setup or clone a gallery template and make it your own.",
        },
      ],
    },
    ctaDashboard: {
      ko: "대시보드 열기",
      en: "Open dashboard",
    },
    ctaInstall: {
      ko: "Chrome에 추가",
      en: "Add to Chrome",
    },
  },
  workspace: {
    heroEyebrow: {
      ko: "오늘의 LinKU",
      en: "Your LinKU today",
    },
    heroTitle: {
      ko: "학교 바로가기부터 Todo까지, 필요한 것부터 시작하세요.",
      en: "Start with what you need, from campus shortcuts to todos.",
    },
    heroBody: {
      ko: "빠른 학교 진입, 공지 모아보기, Todo 관리, 템플릿 적용과 갤러리 탐색까지 한 화면에서 묶었습니다.",
      en: "Keep shortcuts, alerts, todos, templates, and the gallery together in one place.",
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
      shortcuts: { ko: "링크모음", en: "Links" },
      alerts: { ko: "공지사항", en: "Alerts" },
      todos: { ko: "Todo List", en: "Todo List" },
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
      ko: "전체 공지와 내가 보는 카테고리를 나눠서 확인할 수 있습니다.",
      en: "Review all notices or narrow them down to the categories you follow.",
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
      ko: "eCampus 계정으로 Todo를 한 번 불러옵니다. 입력한 계정 정보는 저장하지 않습니다.",
      en: "Load your eCampus todos once. The credentials you enter are not saved.",
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
      ko: "빠른 링크 구성을 고르고 저장해 내 시작 화면에 적용할 수 있습니다.",
      en: "Choose, save, and apply a shortcut layout to your start screen.",
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
      ko: "마음에 드는 바로가기 구성을 가져와 내 템플릿으로 바로 적용할 수 있습니다.",
      en: "Clone a shortcut setup you like and apply it as your own template.",
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
