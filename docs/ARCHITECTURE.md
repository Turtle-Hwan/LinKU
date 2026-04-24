# 아키텍처

이 문서는 LinKU가 런타임에서 어떻게 구성되는지, 그리고 어느 위치를 어떻게
수정해야 안전한지 설명합니다.

## 시스템 개요

LinKU는 Vite, React, TypeScript, Tailwind CSS로 만든 Manifest V3 Chrome
Extension입니다. 확장 프로그램은 두 개의 런타임 영역을 가집니다.

- `index.html`에서 렌더링되는 Popup UI.
- `src/background/index.ts`에서 빌드되는 Background service worker.

현재 프로젝트에는 content script가 없습니다. 확장 프로그램은 임의의 web page에
UI나 logic을 주입하지 않습니다. 대부분의 user interaction은 popup 내부에서
일어납니다.

## 빌드 모델

`vite.config.ts`는 extension mode에서 multi-entry build를 설정합니다.

- `index.html`은 popup entry가 됩니다.
- `src/background/index.ts`는 `background/index.js`가 됩니다.

`gh-pages` mode에서는 build output이 `gh-pages/`로 바뀌고, static hosting을
위해 banner asset이 복사됩니다. extension build의 output directory는
`dist/`입니다.

중요한 script:

```bash
pnpm run dev
pnpm run build:local
pnpm run build
pnpm run watch:local
pnpm run build:gh-pages
```

`pnpm run build`는 build 전에 manifest patch version을 증가시킵니다. local
validation에서 version bump를 원하지 않는다면 `pnpm run build:local`을
사용하세요.

## 런타임 진입점

Popup UI 흐름:

```text
index.html
  -> src/main.tsx
  -> src/routes.tsx
  -> src/App.tsx
  -> route pages and layouts
```

Background worker 흐름:

```text
public/manifest.json
  -> background.service_worker: background/index.js
  -> src/background/index.ts
  -> src/background/handlers/oauth.ts
```

popup은 React Router의 hash routing을 사용합니다. Chrome extension popup
page는 일반적인 server-backed web route처럼 동작하지 않기 때문에 hash routing을
사용합니다.

## 라우트

route는 `src/routes.tsx`에 정의되어 있습니다.

- `/`: `MainLayout` 안의 main popup page.
- `/editor`: 새 template editor.
- `/editor/:templateId`: 기존 template editor.
- `/templates`: owned/local template list.
- `/gallery`: public posted-template gallery.
- `*`: not found page.

`src/App.tsx`는 root error boundary, global providers, page-view analytics,
toast rendering을 제공합니다.

## 소스 구조

```text
src/
  apis/          LinKU backend API wrapper
  apis/external/ 학교 또는 외부 서비스 integration
  assets/        local image와 SVG asset
  background/    Manifest V3 service worker code
  components/    feature component와 UI primitive
  constants/     정적 app data
  contexts/      React Context 상태 container
  hooks/         reusable React hook
  layouts/       route layout wrapper
  pages/         route 단위 screen
  types/         공유 TypeScript contract
  utils/         storage, auth, analytics, template, Chrome helper
```

## 주요 기능 영역

기본 popup 기능:

- Link groups: `src/components/Tabs/LinkGroup.tsx`
- Banners: `src/components/Tabs/ImageCarousel.tsx`
- Todo list: `src/components/Tabs/TodoList/`
- Alerts: `src/components/Tabs/Alerts/`
- Labs: `src/components/Labs/`

Template system 구성:

- Editor page: `src/pages/EditorPage.tsx`
- Template list: `src/pages/TemplateListPage.tsx`
- Public gallery: `src/pages/GalleryPage.tsx`
- Editor state: `src/contexts/EditorContext.tsx`
- Editor UI: `src/components/Editor/`
- Local template persistence: `src/utils/templateStorage.ts`
- Template helper: `src/utils/template.ts`

Auth 및 account 관련 UI:

- OAuth popup/background bridge: `src/utils/oauth.ts`
- Background OAuth handler: `src/background/handlers/oauth.ts`
- API auth interceptor: `src/apis/client.ts`
- Email verification dialog: `src/components/EmailVerificationDialog.tsx`
- Settings dialog: `src/components/SettingsDialog.tsx`

## Popup과 Background 통신

popup은 `chrome.runtime.sendMessage`를 사용해 background service worker와
통신합니다.

message type과 guard는 `src/background/types.ts`에 있습니다.

background worker가 처리하는 일:

- Google login request.
- Silent reauth request.
- Extension install/update event.
- Badge count initialization.
- `chrome.storage.local` 변경에 따른 badge count update.

OAuth는 background worker에 있습니다. `chrome.identity.launchWebAuthFlow`는
일반 browser page flow가 아니라 extension API로 다뤄야 하기 때문입니다.

## Backend API 흐름

중앙 HTTP client는 `src/apis/client.ts`입니다.

주요 책임:

- `VITE_API_BASE_URL`에서 backend URL을 구성합니다.
- `chrome.storage.local`의 bearer token을 request에 붙입니다.
- backend response envelope을 parsing합니다.
- token-expired backend code `5004`를 감지합니다.
- background worker에 silent reauth를 요청합니다.
- silent reauth 성공 후 original request를 한 번 retry합니다.
- hard auth failure에서 `auth:unauthorized`를 dispatch합니다.

feature-specific API module은 fetch behavior를 중복 구현하지 말고 이 client를
사용해야 합니다.

## Storage 모델

현재 storage는 두 browser storage system으로 나뉘어 있습니다.

- `chrome.storage.local`: auth token, user profile state, settings, custom
  todo, library token, badge count.
- `localStorage`: `src/utils/templateStorage.ts`를 통한 template draft와 local
  template persistence.

이 분리는 과거 설계의 결과입니다. template local persistence flow를 직접
수정하는 경우가 아니라면, 새 extension-wide state는 `chrome.storage.local`을
우선 사용하세요.

stored data shape를 바꿀 때는 기존 user의 migration behavior를 고려해야
합니다. LinKU는 실제 user에게 배포되는 extension이므로 가능한 한 backward
compatible해야 합니다.

## 인증

Google OAuth flow는 backend-mediated flow입니다.

1. popup이 background worker에 login 시작을 요청합니다.
2. background worker가 extension redirect URI를 계산합니다.
3. background worker가 `chrome.identity.launchWebAuthFlow`로 backend Google
   OAuth URL을 엽니다.
4. backend가 auth code를 포함해 redirect합니다.
5. background worker가 backend를 통해 code를 token으로 교환합니다.
6. token은 `chrome.storage.local`에 저장됩니다.
7. popup/API state가 auth success 또는 failure에 반응합니다.

auth code, access token, refresh token, full token response를 로그로 남기지
마세요.

## 외부 연동

`src/apis/external/`에는 이 repository가 소유하지 않는 integration이 있습니다.
예시는 eCampus, library, banners, RSS, HTML parsing입니다.

이 module들은 external service의 response shape 또는 DOM structure가 바뀌면
깨질 수 있습니다. 이 영역의 변경은 PR에 manual verification notes를 포함해야
합니다.

## UI 시스템

UI는 다음을 사용합니다.

- Styling에는 Tailwind CSS를 사용합니다.
- `src/components/ui/` 아래에는 shadcn-style Radix wrapper가 있습니다.
- Icon에는 `lucide-react`를 사용합니다.
- Toast notification에는 `sonner`를 사용합니다.
- Editor drag behavior에는 `@dnd-kit/*`를 사용합니다.
- Carousel behavior에는 `embla-carousel`을 사용합니다.

새 component library를 도입하기보다 existing UI primitive와 local pattern을
우선 사용하세요.

## CI와 배포

GitHub Actions workflow는 `.github/workflows/`에 있습니다.

- `pr-build-check.yml`: PR에서 local production-like build check를 실행합니다.
- `upload-chrome-extension-draft.yml`: main에서 Chrome Web Store draft를
  upload합니다.
- `create-release.yml`: GitHub Release를 만들고 built zip을 첨부합니다.
- `deploy-gh-pages.yml`: static assets/pages를 `gh-pages`에 deploy합니다.

main branch는 release-sensitive합니다. versioning과 deployment behavior는
의도적으로 변경하고 PR에 문서화해야 합니다.

## 알려진 기술 부채

- lint는 설정되어 있지만 현재 PR CI에서 강제하지 않습니다.
- test framework 또는 automated browser extension test suite가 없습니다.
- `README.md`는 product-focused 문서이며, 깊은 협업 문서는 `docs/` 아래에
  있습니다.
- 일부 production code에 diagnostic logging이 남아 있습니다.
- `public/manifest.json`에는 broad host permissions가 포함되어 있습니다.
- template persistence는 `localStorage`를 사용하고, 다른 extension state는
  `chrome.storage.local`을 사용합니다.

이 항목들은 별도 cleanup PR로 다루기 좋습니다. unrelated feature work에 섞지
마세요.

