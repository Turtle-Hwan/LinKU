export interface LinkuPageSummary {
  slug: string;
  title: string;
  summary: string;
  path: string;
}

export interface LinkuFeature extends LinkuPageSummary {
  highlights: string[];
}

export interface LinkuService extends LinkuPageSummary {
  audience: string;
  tasks: string[];
}

export interface LinkuGuide extends LinkuPageSummary {
  steps: string[];
}

export interface LinkuUpdateEntry {
  slug: string;
  title: string;
  publishedAt: string;
  summary: string;
  bullets: string[];
}

export interface LinkuFaqItem {
  question: string;
  answer: string;
}

export type LinkuAppNavItem = LinkuPageSummary;

export const FEATURES: LinkuFeature[] = [
  {
    slug: "todo",
    title: "Todo overview",
    summary:
      "See campus deadlines and personal tasks together, then jump back into work from the extension popup.",
    path: "/features/todo",
    highlights: [
      "Capture lightweight todos without leaving the popup card.",
      "Track personal tasks alongside the school workflows you repeat every week.",
      "Use web guides and extension shortcuts together instead of memorizing campus paths.",
    ],
  },
  {
    slug: "ecampus",
    title: "eCampus launcher",
    summary:
      "Open Konkuk eCampus in fewer clicks, keep key routes nearby, and reduce tab hunting during busy weeks.",
    path: "/features/ecampus",
    highlights: [
      "Jump from the popup to eCampus, portal, and calendar routes without extra search.",
      "Keep the extension focused on browser-native workflows that the web app should not duplicate.",
      "Pair installation guides on the public site with direct extension entry for real usage.",
    ],
  },
  {
    slug: "bookmarks",
    title: "Campus bookmarks",
    summary:
      "Bundle the pages students reopen every day, then prepare for favorites and personalized links on the web surface.",
    path: "/features/bookmarks",
    highlights: [
      "Organize your most-used campus pages in one predictable place.",
      "Use service landing pages as SEO-friendly entry points before installation.",
      "Prepare for authenticated favorites and personal link groups on the single-domain web app.",
    ],
  },
];

export const SERVICES: LinkuService[] = [
  {
    slug: "ecampus",
    title: "Konkuk eCampus",
    summary:
      "Navigate lectures, notices, and assignment checkpoints with less friction around the busiest student workflows.",
    path: "/services/ecampus",
    audience: "Students who revisit eCampus multiple times a day",
    tasks: [
      "Open lecture materials faster",
      "Check assignments before deadlines",
      "Review announcements without digging through menus",
    ],
  },
  {
    slug: "konkuk-portal",
    title: "Konkuk portal",
    summary:
      "Keep the academic portal, timetable, and core student services within easy reach from both public guides and extension entry points.",
    path: "/services/konkuk-portal",
    audience: "Students checking grades, registration, and campus admin flows",
    tasks: [
      "Review grades and registration windows",
      "Find admin tools without repeated navigation",
      "Move between portal and supporting services quickly",
    ],
  },
  {
    slug: "academic-calendar",
    title: "Academic calendar",
    summary:
      "Track the semester rhythm, from registration milestones to exam windows, with fewer missed campus dates.",
    path: "/services/academic-calendar",
    audience: "Students planning around official school deadlines",
    tasks: [
      "Check course registration windows",
      "See add-drop and withdrawal dates",
      "Plan around midterm and final exam periods",
    ],
  },
];

export const GUIDES: LinkuGuide[] = [
  {
    slug: "install-extension",
    title: "Install the extension",
    summary:
      "Go from Chrome Web Store install to daily usage in the popup card without guessing which step comes next.",
    path: "/guides/install-extension",
    steps: [
      "Open the LinKU Chrome Web Store page.",
      "Add the extension to Chrome and pin it to the toolbar.",
      "Open the popup and start from the campus shortcuts you use most often.",
    ],
  },
  {
    slug: "how-to-use-linku",
    title: "How to use LinKU",
    summary:
      "Learn the first useful workflow after install, from shortcut discovery to favorites and extension connection.",
    path: "/guides/how-to-use-linku",
    steps: [
      "Open frequently used campus pages through the popup instead of manual navigation.",
      "Review guides and service pages on the web surface when you need more context.",
      "Sign in on the web to prepare favorites, settings, and extension connection flows.",
    ],
  },
];

export const FAQ_ITEMS: LinkuFaqItem[] = [
  {
    question: "What is LinKU?",
    answer:
      "LinKU is a Chrome-extension-first companion for Konkuk University workflows, paired with a public SEO site and authenticated web routes on the same canonical domain.",
  },
  {
    question: "Can I use LinKU without installing the extension?",
    answer:
      "Yes for guides, install help, feature overviews, FAQs, and service landing pages. The fastest campus workflows still live in the Chrome extension.",
  },
  {
    question: "What is the authenticated web surface for?",
    answer:
      "It handles Google sign-in, personal favorites, settings, account management, and extension connection status inside path-based routes such as /login and /dashboard.",
  },
  {
    question: "Which browser is supported first?",
    answer:
      "This MVP is designed around Chrome and Chrome Web Store distribution because the core flows depend on browser extension capabilities.",
  },
  {
    question: "How are the domains organized now?",
    answer:
      "The public pages and authenticated routes both live on the single canonical domain https://www.linku.xxx, while the apex domain redirects there and api.linku.xxx remains optional for a future BFF split.",
  },
];

export const UPDATE_ENTRIES: LinkuUpdateEntry[] = [
  {
    slug: "monorepo-foundation",
    title: "Monorepo foundation",
    publishedAt: "2026-03-14",
    summary:
      "The workspace now separates the extension, shared packages, and the upcoming single-domain web surface.",
    bullets: [
      "The existing Chrome extension lives in apps/extension.",
      "Shared UI, config, platform, SEO, and type packages are now part of the workspace.",
      "Public web content and authenticated route helpers are being prepared around a single canonical domain.",
    ],
  },
  {
    slug: "single-domain-web",
    title: "Single-domain web direction",
    publishedAt: "2026-03-14",
    summary:
      "The split between www and app subdomains was removed in favor of one Next.js app on the canonical web domain.",
    bullets: [
      "Public SEO routes and authenticated routes will both run on www.linku.xxx.",
      "Canonical URLs, OAuth callbacks, and session handling now share the same base URL.",
      "Authenticated routes follow a noindex policy by default.",
    ],
  },
];

export const TOP_NAV_LINKS: LinkuPageSummary[] = [
  {
    slug: "install",
    title: "Install",
    summary: "Install the extension",
    path: "/install",
  },
  {
    slug: "features",
    title: "Features",
    summary: "Feature overviews",
    path: "/features",
  },
  {
    slug: "services",
    title: "Services",
    summary: "Campus service landing pages",
    path: "/services",
  },
  {
    slug: "guides",
    title: "Guides",
    summary: "Setup and usage docs",
    path: "/guides",
  },
  {
    slug: "faq",
    title: "FAQ",
    summary: "Common questions",
    path: "/faq",
  },
  {
    slug: "updates",
    title: "Updates",
    summary: "Release notes and changes",
    path: "/updates",
  },
];

export const APP_NAV_LINKS: LinkuAppNavItem[] = [
  {
    slug: "dashboard",
    title: "Dashboard",
    summary: "Signed-in overview and next steps",
    path: "/dashboard",
  },
  {
    slug: "links",
    title: "Links",
    summary: "Personal shortcut collection",
    path: "/links",
  },
  {
    slug: "favorites",
    title: "Favorites",
    summary: "Saved campus pages and guides",
    path: "/favorites",
  },
  {
    slug: "settings",
    title: "Settings",
    summary: "Preferences and defaults",
    path: "/settings",
  },
  {
    slug: "account",
    title: "Account",
    summary: "Profile and session information",
    path: "/account",
  },
  {
    slug: "extension-connect",
    title: "Extension",
    summary: "Check extension connection state",
    path: "/extension/connect",
  },
];

export const PUBLIC_ROUTE_PATHS = [
  "/",
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
  "/links",
  "/favorites",
  "/settings",
  "/account",
  "/extension/connect",
];
