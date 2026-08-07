export interface LinkuPageSummary {
  slug: string;
  path: string;
  titleKey: string;
  summaryKey: string;
}

export interface LinkuFeature extends LinkuPageSummary {
  highlightKeys: string[];
}

export interface LinkuService extends LinkuPageSummary {
  audienceKey: string;
  taskKeys: string[];
}

export interface LinkuGuide extends LinkuPageSummary {
  stepKeys: string[];
}

export interface LinkuUpdateEntry {
  slug: string;
  publishedAt: string;
  titleKey: string;
  summaryKey: string;
  bulletKeys: string[];
}

export interface LinkuFaqItem {
  slug: string;
  questionKey: string;
  answerKey: string;
}

export type LinkuAppNavItem = LinkuPageSummary;

export const FEATURES: LinkuFeature[] = [
  {
    slug: "todo",
    path: "/features/todo",
    titleKey: "site.features.todo.title",
    summaryKey: "site.features.todo.summary",
    highlightKeys: [
      "site.features.todo.highlight1",
      "site.features.todo.highlight2",
      "site.features.todo.highlight3",
    ],
  },
  {
    slug: "ecampus",
    path: "/features/ecampus",
    titleKey: "site.features.ecampus.title",
    summaryKey: "site.features.ecampus.summary",
    highlightKeys: [
      "site.features.ecampus.highlight1",
      "site.features.ecampus.highlight2",
      "site.features.ecampus.highlight3",
    ],
  },
  {
    slug: "bookmarks",
    path: "/features/bookmarks",
    titleKey: "site.features.bookmarks.title",
    summaryKey: "site.features.bookmarks.summary",
    highlightKeys: [
      "site.features.bookmarks.highlight1",
      "site.features.bookmarks.highlight2",
      "site.features.bookmarks.highlight3",
    ],
  },
];

export const SERVICES: LinkuService[] = [
  {
    slug: "ecampus",
    path: "/services/ecampus",
    titleKey: "site.services.ecampus.title",
    summaryKey: "site.services.ecampus.summary",
    audienceKey: "site.services.ecampus.audience",
    taskKeys: [
      "site.services.ecampus.task1",
      "site.services.ecampus.task2",
      "site.services.ecampus.task3",
    ],
  },
  {
    slug: "konkuk-portal",
    path: "/services/konkuk-portal",
    titleKey: "site.services.konkukPortal.title",
    summaryKey: "site.services.konkukPortal.summary",
    audienceKey: "site.services.konkukPortal.audience",
    taskKeys: [
      "site.services.konkukPortal.task1",
      "site.services.konkukPortal.task2",
      "site.services.konkukPortal.task3",
    ],
  },
  {
    slug: "academic-calendar",
    path: "/services/academic-calendar",
    titleKey: "site.services.academicCalendar.title",
    summaryKey: "site.services.academicCalendar.summary",
    audienceKey: "site.services.academicCalendar.audience",
    taskKeys: [
      "site.services.academicCalendar.task1",
      "site.services.academicCalendar.task2",
      "site.services.academicCalendar.task3",
    ],
  },
];

export const GUIDES: LinkuGuide[] = [
  {
    slug: "install-extension",
    path: "/guides/install-extension",
    titleKey: "site.guides.installExtension.title",
    summaryKey: "site.guides.installExtension.summary",
    stepKeys: [
      "site.guides.installExtension.step1",
      "site.guides.installExtension.step2",
      "site.guides.installExtension.step3",
    ],
  },
  {
    slug: "how-to-use-linku",
    path: "/guides/how-to-use-linku",
    titleKey: "site.guides.howToUseLinku.title",
    summaryKey: "site.guides.howToUseLinku.summary",
    stepKeys: [
      "site.guides.howToUseLinku.step1",
      "site.guides.howToUseLinku.step2",
      "site.guides.howToUseLinku.step3",
    ],
  },
];

export const FAQ_ITEMS: LinkuFaqItem[] = [
  {
    slug: "what-is-linku",
    questionKey: "site.faq.whatIsLinku.question",
    answerKey: "site.faq.whatIsLinku.answer",
  },
  {
    slug: "without-extension",
    questionKey: "site.faq.withoutExtension.question",
    answerKey: "site.faq.withoutExtension.answer",
  },
  {
    slug: "authenticated-surface",
    questionKey: "site.faq.authenticatedSurface.question",
    answerKey: "site.faq.authenticatedSurface.answer",
  },
  {
    slug: "supported-browser",
    questionKey: "site.faq.supportedBrowser.question",
    answerKey: "site.faq.supportedBrowser.answer",
  },
  {
    slug: "domain-policy",
    questionKey: "site.faq.domainPolicy.question",
    answerKey: "site.faq.domainPolicy.answer",
  },
];

export const UPDATE_ENTRIES: LinkuUpdateEntry[] = [
  {
    slug: "monorepo-foundation",
    publishedAt: "2026-03-14",
    titleKey: "site.updates.monorepoFoundation.title",
    summaryKey: "site.updates.monorepoFoundation.summary",
    bulletKeys: [
      "site.updates.monorepoFoundation.bullet1",
      "site.updates.monorepoFoundation.bullet2",
      "site.updates.monorepoFoundation.bullet3",
    ],
  },
  {
    slug: "single-domain-web",
    publishedAt: "2026-03-14",
    titleKey: "site.updates.singleDomainWeb.title",
    summaryKey: "site.updates.singleDomainWeb.summary",
    bulletKeys: [
      "site.updates.singleDomainWeb.bullet1",
      "site.updates.singleDomainWeb.bullet2",
      "site.updates.singleDomainWeb.bullet3",
    ],
  },
];

export const TOP_NAV_LINKS: LinkuPageSummary[] = [
  {
    slug: "install",
    path: "/install",
    titleKey: "site.navigation.top.install.title",
    summaryKey: "site.navigation.top.install.summary",
  },
  {
    slug: "features",
    path: "/features",
    titleKey: "site.navigation.top.features.title",
    summaryKey: "site.navigation.top.features.summary",
  },
  {
    slug: "services",
    path: "/services",
    titleKey: "site.navigation.top.services.title",
    summaryKey: "site.navigation.top.services.summary",
  },
  {
    slug: "guides",
    path: "/guides",
    titleKey: "site.navigation.top.guides.title",
    summaryKey: "site.navigation.top.guides.summary",
  },
  {
    slug: "faq",
    path: "/faq",
    titleKey: "site.navigation.top.faq.title",
    summaryKey: "site.navigation.top.faq.summary",
  },
  {
    slug: "updates",
    path: "/updates",
    titleKey: "site.navigation.top.updates.title",
    summaryKey: "site.navigation.top.updates.summary",
  },
];

export const APP_NAV_LINKS: LinkuAppNavItem[] = [
  {
    slug: "shortcuts",
    path: "/shortcuts",
    titleKey: "site.navigation.app.shortcuts.title",
    summaryKey: "site.navigation.app.shortcuts.summary",
  },
  {
    slug: "alerts",
    path: "/alerts",
    titleKey: "site.navigation.app.alerts.title",
    summaryKey: "site.navigation.app.alerts.summary",
  },
  {
    slug: "timetable",
    path: "/timetable",
    titleKey: "site.navigation.app.timetable.title",
    summaryKey: "site.navigation.app.timetable.summary",
  },
  {
    slug: "todos",
    path: "/todos",
    titleKey: "site.navigation.app.todos.title",
    summaryKey: "site.navigation.app.todos.summary",
  },
  {
    slug: "templates",
    path: "/templates",
    titleKey: "site.navigation.app.templates.title",
    summaryKey: "site.navigation.app.templates.summary",
  },
  {
    slug: "gallery",
    path: "/gallery",
    titleKey: "site.navigation.app.gallery.title",
    summaryKey: "site.navigation.app.gallery.summary",
  },
  {
    slug: "labs",
    path: "/labs",
    titleKey: "site.navigation.app.labs.title",
    summaryKey: "site.navigation.app.labs.summary",
  },
];

export const PUBLIC_ROUTE_PATHS = [
  "/",
  "/intro",
  "/install",
  "/features",
  ...FEATURES.map((feature) => feature.path),
  "/services",
  ...SERVICES.map((service) => service.path),
  "/guides",
  ...GUIDES.map((guide) => guide.path),
  "/faq",
  "/updates",
  "/privacy",
];

export const AUTH_ROUTE_PATHS = [
  "/login",
  "/dashboard",
  "/shortcuts",
  "/alerts",
  "/timetable",
  "/todos",
  "/labs",
  "/templates",
  "/editor",
  "/gallery",
  "/links",
  "/favorites",
  "/settings",
  "/account",
  "/extension/connect",
];
