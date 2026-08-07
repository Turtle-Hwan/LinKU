# Contributing to LinKU

LinKU는 실제 Chrome Web Store 확장 프로그램과 공개/인증 웹앱을 함께
운영합니다. 변경은 앱 경계, 기존 설치 사용자, 검색 노출, 인증, 배포 자동화에
미치는 영향을 분명히 한 상태로 진행합니다.

## 1. 시작하기

### 요구사항

- Node.js 24 LTS
- pnpm 10.32.1
- Chrome 또는 Chromium 계열 브라우저

```bash
pnpm install --frozen-lockfile
```

개발 환경 파일은 example을 기준으로 각 앱에 만듭니다. 실제 secret이 들어간
파일은 커밋하지 마세요.

```text
apps/web/.env.local       ← apps/web/.env.example
apps/extension/.env.local ← apps/extension/.env.example
```

### 개발 서버

```bash
pnpm dev:web
pnpm dev:extension
```

웹은 Next.js 개발 서버로 확인합니다. Extension Vite dev mode는 popup UI의
빠른 반복 확인용이며 Chrome identity, storage, action, badge, background
service worker를 완전히 재현하지 않습니다.

## 2. 변경 위치

### Extension 전용

- Popup route/page: `apps/extension/src/pages/`, `src/layouts/`
- Popup feature: `apps/extension/src/components/`
- Editor: `apps/extension/src/components/Editor/`
- Backend wrapper: `apps/extension/src/apis/`
- External parser: `apps/extension/src/apis/external/`
- Chrome runtime: `apps/extension/src/background/`, `src/utils/chrome.ts`
- Manifest: `apps/extension/public/manifest.json`

### Web 전용

- Page/layout/metadata: `apps/web/app/`
- Route Handler: `apps/web/app/api/`
- Auth.js: `apps/web/auth.ts`
- Locale routing: `apps/web/i18n/`, `apps/web/proxy.ts`
- Web feature UI: `apps/web/components/`
- Server/client helper: `apps/web/lib/`

### 공유 대상

- Reusable UI primitive: `packages/ui`
- Product content와 campus catalog: `packages/core`
- Chrome/web capability와 bridge contract: `packages/platform`
- Metadata, JSON-LD, sitemap, robots: `packages/seo`
- Serializable shared contract: `packages/shared-types`
- Environment parser와 constant: `packages/config`

Chrome API, Next server API, app router, 앱별 storage에 직접 의존하는 코드는
공유 패키지로 옮기지 않습니다.

## 3. 환경 변수

### Web

- `AUTH_SECRET`: 필수. Auth.js session signing
- `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`: Google login
- `NEXT_PUBLIC_SITE_URL`: canonical production URL
- `NEXT_PUBLIC_EXTENSION_URL`: Chrome Web Store listing URL
- `NEXT_PUBLIC_EXTENSION_ID`: 실제 extension ID
- `LINKU_API_BASE_URL`: legacy LinKU backend server URL

### Extension

- `VITE_ENVIRONMENT`: development, ci, production
- `VITE_SITE_URL`, `VITE_WEB_BASE_URL`: canonical web URL
- `VITE_API_BASE_URL`: legacy LinKU backend
- `VITE_GA_API_SECRET`: 기존 GA Measurement Protocol 설정

`NEXT_PUBLIC_*`와 `VITE_*`는 client bundle에 들어갈 수 있습니다. 민감한
credential을 새로 추가하지 마세요. 기존 analytics/backend 설정을 변경할
때도 실제 bundle 노출 범위를 확인하세요.

## 4. 검증

### 모든 코드 변경

```bash
pnpm lint
pnpm typecheck
pnpm build
```

`pnpm build`는 web production build와 manifest version을 올리지 않는
extension production validation build를 실행합니다.

### Extension 변경

```bash
pnpm build:extension:local
```

`apps/extension/dist/`를 `chrome://extensions`에서 unpacked extension으로
로드하고 관련 흐름을 확인합니다.

- Popup route와 핵심 interaction
- `chrome.storage.local` read/write와 migration
- Badge와 `chrome.action`
- Background service worker console
- OAuth/silent reauth failure handling
- Manifest permission 또는 host permission

실제 credential이 없으면 OAuth/backend 성공까지 검증했다고 쓰지 마세요.

### Web 변경

최소 확인 항목:

- `/`와 `/en`의 locale/canonical 동작
- 공개 page navigation, install CTA, FAQ/guide detail
- login entry와 Google provider 미설정 fallback
- protected route의 login redirect
- sitemap, robots, Open Graph, 404
- desktop/mobile responsive layout
- browser console error와 failed request

SEO 변경은 generated metadata, canonical, hreflang, `noindex`, structured data를
함께 확인합니다.

### Shared package 변경

공유 패키지는 두 앱의 build를 모두 실행합니다. Type contract 변경은 producer와
consumer를 같은 변경에서 갱신합니다.

## 5. 보안 및 개인정보

- Token, auth code, password, private user data를 로그에 남기지 않습니다.
- OAuth return URL은 same-origin 또는 명시적 allowlist로 제한합니다.
- Route Handler는 입력 shape, URL scheme, session/ownership을 검증합니다.
- Protected page와 개인 데이터 endpoint는 server-side auth를 확인합니다.
- Chrome `permissions`와 `host_permissions`는 최소 범위로 유지합니다.
- External URL을 새 창으로 열 때 opener isolation을 유지합니다.
- Credential이 필요한 school integration은 client storage와 transport 범위를
  문서화합니다.

## 6. Manifest와 version

일반 코드 변경에서 `apps/extension/public/manifest.json`의 version을 직접
올리지 마세요. Release workflow가
`apps/extension/scripts/updateVersion.js`를 통해 patch version을 관리합니다.

Manifest permission 변경에는 다음을 기록합니다.

- 필요한 사용자 기능
- 더 좁은 permission으로 대체할 수 없는 이유
- 기존 사용자와 Chrome Web Store review 영향
- unpacked extension에서 검증한 내용

## 7. Git과 PR

- 작업 전 `git status`로 사용자 변경을 확인합니다.
- 한 커밋에는 하나의 논리적 변화를 담습니다.
- unrelated formatting이나 generated output을 섞지 않습니다.
- `apps/extension/dist`, `apps/web/.next`, secret env file은 커밋하지 않습니다.
- PR에는 영향받은 app/package, 실행한 검증, 수동 검증, 미검증 외부 연동을
  적습니다.
- CI/CD 또는 credential 변경은 자동 배포와 version bump timing을 별도로
  검토합니다.

`main` push는 web deploy, extension draft upload, release workflow를 실행할 수
있습니다. 외부 secret과 배포 조건을 확인하지 않은 상태에서 merge하지 마세요.

## 8. 배포

실제 도메인, Google OAuth, Vercel, Cloudflare, Chrome Web Store 연결 절차와
필수 secret은 `DEPLOYMENT.md`를 따릅니다. Placeholder build 성공과 production
배포 성공을 구분해 기록하세요.
