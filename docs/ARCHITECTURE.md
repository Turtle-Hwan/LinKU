# LinKU Architecture

이 문서는 현재 LinKU 모노레포의 런타임 경계와 주요 데이터 흐름을 설명합니다.
제품 및 구현 요구사항의 정본은 `IMPLEMENTATION_SPEC.md`입니다.

## 1. 시스템 개요

```text
Cloudflare
  └─ DNS, TLS, redirects, edge security
      └─ Vercel
          └─ apps/web (Next.js)
              ├─ public SEO pages
              ├─ authenticated workspace
              └─ Route Handlers / Auth.js

Chrome Web Store
  └─ apps/extension (MV3 React + Vite)
      ├─ popup UI
      ├─ background service worker
      ├─ Chrome storage/identity/action
      └─ legacy LinKU backend integration

packages/*
  └─ types, UI, content, platform boundaries, SEO, configuration
```

Cloudflare는 애플리케이션 배포 대상이 아니라 canonical domain 앞단입니다.
웹 애플리케이션은 Vercel에 배포하고 확장 프로그램은 Chrome Web Store에서
배포합니다.

## 2. Workspace 구조

```text
apps/
  extension/     Manifest V3 Chrome extension
  web/           Next.js App Router application
packages/
  config/        shared constants and environment readers
  core/          product copy, route content, catalog data
  platform/      capability checks, deep links, bridge contracts
  seo/           metadata, JSON-LD, sitemap, robots
  shared-types/  API, auth, analytics, extension bridge types
  ui/            shared React UI primitives
tooling/
  eslint/        shared flat ESLint config
  typescript/    shared TypeScript config
```

앱은 브라우저 권한이나 framework runtime을 소유하고, 패키지는 양쪽 앱에서
재사용할 수 있는 순수한 contract와 UI를 소유합니다. 공유 패키지에서
`chrome.*`, Next.js server API, 앱 전용 storage에 직접 접근하지 않습니다.

## 3. Extension runtime

### 3.1 Entrypoint

Popup:

```text
apps/extension/index.html
  → src/main.tsx
  → src/routes.tsx
  → src/App.tsx
  → pages and layouts
```

Background:

```text
apps/extension/public/manifest.json
  → background.service_worker: background/index.js
  → src/background/index.ts
  → src/background/handlers/oauth.ts
```

Vite는 popup과 background worker를 multi-entry로 빌드하고 결과를
`apps/extension/dist/`에 만듭니다. Popup은 extension 환경에 맞춰 hash
routing을 사용합니다.

### 3.2 기능 책임

- `src/components/Tabs/`: link, banner, todo, alerts
- `src/components/Editor/`: template editor canvas와 control
- `src/components/Labs/`: library seats, QR, server clock
- `src/pages/`: editor, template list, gallery route screen
- `src/contexts/`: editor와 posted-template state
- `src/apis/`: legacy LinKU backend wrapper
- `src/apis/external/`: eCampus, library, RSS, HTML parser
- `src/background/`: OAuth, badge, runtime message handling
- `src/utils/`: Chrome storage, analytics, auth, template persistence

현재 content script는 없습니다. Popup과 background worker의 통신은
`chrome.runtime.sendMessage`와 `src/background/types.ts`의 guard를 사용합니다.

### 3.3 Extension auth와 storage

Extension OAuth는 `chrome.identity.launchWebAuthFlow`를 사용하는
backend-mediated flow입니다. Auth code와 token 처리는 background worker가
담당하며 token은 `chrome.storage.local`에 저장됩니다.

- `chrome.storage.local`: auth, profile, settings, todo, badge, library state
- `localStorage`: `src/utils/templateStorage.ts`의 local template/draft

저장 데이터 shape 변경은 기존 설치 사용자의 migration을 고려해야 합니다.
Auth code, access token, refresh token, private profile을 로그로 남기면 안 됩니다.

## 4. Web runtime

### 4.1 Route 구조

`apps/web/app/[locale]/`가 한국어와 영어 surface를 함께 제공합니다.

- Marketing: `/`, `/intro`, `/features`, `/services`, `/guides`, `/faq`,
  `/install`, `/updates`, `/privacy`
- Auth: `/login`
- Protected workspace: `/dashboard`, `/account`, `/favorites`, `/links`,
  `/settings`, `/labs`, `/templates`, `/editor`, `/gallery`,
  `/extension/connect`
- Server endpoints: `apps/web/app/api/`

기본 한국어 URL은 locale prefix 없이 노출되고 내부적으로 `/ko`에 rewrite됩니다.
영어 URL은 `/en` prefix를 사용합니다. `apps/web/proxy.ts`가 locale cookie와
`Accept-Language`를 기준으로 이 경계를 처리합니다.

### 4.2 SEO surface

공개 페이지는 정적 생성 가능한 콘텐츠를 우선합니다.

- metadata와 canonical: `packages/seo`
- sitemap/robots: `apps/web/app/sitemap.ts`, `robots.ts`
- Open Graph image: `apps/web/app/**/opengraph-image.tsx`
- JSON-LD: `packages/seo/src/jsonld.ts`
- 공개 콘텐츠 source: `packages/core/src/site-content.ts`

인증 surface는 server-side session guard와 `noindex`가 기본입니다.
Canonical domain은 `NEXT_PUBLIC_SITE_URL`로 구성하며 placeholder를 실제
운영 값으로 교체하기 전에는 production 배포가 완료된 것으로 보지 않습니다.

### 4.3 Web auth와 workspace data

`apps/web/auth.ts`가 Auth.js와 Google provider를 설정합니다.

- `AUTH_SECRET`은 실행에 필수입니다.
- Google client ID/secret이 없으면 빌드는 가능하지만 Google 로그인 provider는
  비활성화됩니다.
- protected layout은 server session을 확인하고 unauthenticated user를
  localized login route로 보냅니다.

초기 웹 workspace 상태는 Route Handler와 사용자별 HTTP-only cookie 기반 local
store를 사용합니다. Legacy backend가 설정된 기능은 server-side handler를
통해 연동하고, 브라우저에서 backend credential이나 token을 직접 노출하지
않습니다. 영구적인 다중 기기 동기화는 실제 backend/DB 연결 후 완성됩니다.

## 5. Shared package 경계

- `@linku/ui`: 양쪽 앱이 실제로 소비하는 React UI primitive
- `@linku/core`: campus quick links, template preset, localized product content
- `@linku/platform`: platform capability와 extension/web link/bridge helper
- `@linku/seo`: Next metadata, sitemap, robots, JSON-LD helper
- `@linku/shared-types`: runtime을 넘나드는 serializable contract
- `@linku/config`: env parser와 canonical constants

공유 대상은 파일 위치가 아니라 실행 환경 독립성으로 판단합니다. Chrome API,
Next server API, 각 앱의 router에 의존하면 해당 앱에 둡니다.

## 6. Build와 배포

```text
pnpm lint
pnpm typecheck
pnpm build
  ├─ apps/web: next build
  └─ apps/extension: production validation build (version bump 없음)
```

Workflow:

- `monorepo-validate.yml`: PR과 main push에서 lint/typecheck/two-app build
- `deploy-web.yml`: web/shared 변경 시 Vercel production deploy
- `deploy-extension-draft.yml`: extension/shared 변경 시 CWS draft upload
- `create-release.yml`: current manifest version의 extension GitHub release

배포 workflow는 secret이 없으면 외부 변경을 건너뜁니다. 실제 credential,
도메인, callback, store ID 설정은 `DEPLOYMENT.md`를 따릅니다.

## 7. 외부 의존성과 알려진 경계

- Google OAuth: 실제 Google Cloud credential과 callback 등록 필요
- Legacy LinKU backend: 회원, template sync, alerts 등 일부 기능에 필요
- School/external sites: markup 또는 정책 변경 시 parser가 깨질 수 있음
- Chrome runtime: dev server만으로 identity/storage/badge/service worker 검증 불가
- Web workspace persistence: production backend/DB 연결 전에는 제한적
- Deployment: Vercel, Cloudflare, CWS credential 없이는 end-to-end 검증 불가

외부 연동이 없는 placeholder build와 실제 운영 검증을 항상 구분해
보고하세요.
