# AGENTS.md

이 문서는 LinKU 모노레포에서 작업하는 코딩 에이전트를 위한 빠른 진입점입니다.
설계, 동작, 배포, 협업 규칙이 관련된 작업이라면 이 문서를 먼저 읽고,
이후 `docs/IMPLEMENTATION_SPEC.md`, `docs/ARCHITECTURE.md`,
`docs/CONTRIBUTING.md`를 확인하세요.

## 프로젝트 개요

LinKU는 건국대학교 학생을 위한 Chrome 확장 프로그램과 웹 서비스를 한
저장소에서 관리합니다.

- `apps/extension`: React + Vite 기반 Manifest V3 Chrome Extension
- `apps/web`: Next.js App Router 기반 공개 SEO 페이지와 인증 웹앱
- `packages/*`: UI, 도메인 데이터, 타입, 플랫폼 경계, SEO, 설정 공유 패키지

현재 정본은 `docs/IMPLEMENTATION_SPEC.md`입니다. 다른 계획 문서와 내용이
충돌하면 구현 스펙을 우선하세요.

## 읽는 순서

1. `README.md`: 구조와 기본 명령
2. `docs/IMPLEMENTATION_SPEC.md`: 제품 및 구현 정본
3. `docs/ARCHITECTURE.md`: 런타임 구조와 데이터 흐름
4. `docs/CONTRIBUTING.md`: 변경, 검증, 릴리즈 규칙
5. 관련 앱 또는 패키지의 source file

## 런타임 구성

### Extension

- Popup UI: `apps/extension/index.html` → `src/main.tsx` → `src/routes.tsx`
- Root app shell: `apps/extension/src/App.tsx`
- Background service worker: `apps/extension/src/background/index.ts`
- OAuth handler: `apps/extension/src/background/handlers/oauth.ts`
- Manifest: `apps/extension/public/manifest.json`

현재 extension에는 content script가 없습니다. manifest가 변경되지 않는 한
페이지 주입 기능이 존재한다고 가정하지 마세요.

### Web

- App Router: `apps/web/app/`
- 공개/인증 locale route: `apps/web/app/[locale]/`
- Route Handlers: `apps/web/app/api/`
- Auth.js 설정: `apps/web/auth.ts`
- Web middleware/proxy: `apps/web/proxy.ts`

## 공통 명령

Node 24 LTS와 pnpm 10.32.1을 사용합니다.

```bash
pnpm install --frozen-lockfile

pnpm dev:extension
pnpm dev:web

pnpm lint
pnpm typecheck
pnpm build
pnpm validate
```

확장 프로그램만 실제 Chrome 환경에서 검증하기 전에는 다음을 실행하고,
`apps/extension/dist/`를 `chrome://extensions`에서 Developer Mode로
로드하세요.

```bash
pnpm build:extension:local
```

Vite dev mode는 React UI 반복 작업용입니다. `chrome.identity`,
`chrome.storage`, `chrome.action`, badge, service worker 동작은 빌드된
확장 프로그램 환경에서 확인해야 합니다.

## 변경 규칙

- 확장 프로그램 popup UI를 LinKU의 시각적 정본으로 취급하세요. 웹은 기능을
  이식할 때 반응형 배치만 조정하고 색상, 글꼴, 반경, 버튼, 탭, 바로가기
  타일의 시각 언어를 새로 해석하지 않습니다.
- 양쪽 앱의 UI primitive는 `@linku/ui`에서만 가져오세요. 앱에서 Radix,
  Sonner, CVA, cmdk, tailwind-merge를 직접 import하지 마세요.
- 공통 색상과 반경은 `@linku/ui/theme.css`를 사용하세요. 기본 글꼴은
  Pretendard, 배경은 흰색, 주 색상은 `#00913a`, hover 색상은 `#007a30`,
  기본 반경은 `0.5rem`입니다.
- 명시적인 디자인 변경 요청과 사용자 확인 없이 새 글꼴, 그라데이션, 큰
  둥근 모서리, 장식용 그림자, 별도 마케팅 팔레트를 추가하지 마세요.
- 웹 전용 page composition은 허용하지만 기존 popup 흐름을 대체하는 별도
  dashboard visual system을 만들지 마세요. 상세 기준은
  `docs/DESIGN_PARITY.md`를 따릅니다.
- `apps/extension/public/manifest.json`의 version을 직접 수정하지 마세요.
  운영 workflow가 `apps/extension/scripts/updateVersion.js`로 올립니다.
- Chrome permission 또는 `host_permissions`를 추가·확대할 때는 이유를
  문서화하고 가능한 한 구체적인 domain을 사용하세요.
- access token, refresh token, auth code, private user data를 로그나
  client-visible 환경 변수에 남기지 마세요.
- `NEXT_PUBLIC_*`와 `VITE_*` 값은 브라우저에 노출될 수 있습니다. secret을
  넣지 마세요.
- 웹의 인증 route는 server-side session protection과 `noindex`를 유지하세요.
- `README.md`는 빠른 시작 중심으로 유지하고 운영 세부사항은 `docs/`에 둡니다.
- 편집 전 `git status`를 확인하고 기존 working tree 변경을 보존하세요.

## 소스 책임 지도

- `apps/extension/src/`: popup, editor, Chrome API, legacy backend integration
- `apps/web/app/`: Next.js page, layout, metadata, Route Handler
- `apps/web/components/`: 웹 전용 UI와 인증 workspace feature
- `packages/core/`: route content, service catalog, product copy
- `packages/ui/`: 양쪽 앱에서 쓰는 UI primitive
- `packages/platform/`: extension/web capability 및 bridge helper
- `packages/seo/`: metadata, JSON-LD, sitemap, robots helper
- `packages/shared-types/`: 공유 API, auth, analytics, bridge contract
- `packages/config/`: 공통 constant와 environment reader
- `tooling/`: workspace ESLint와 TypeScript 설정

## 주의 영역

- `apps/extension/public/manifest.json`: permission, entrypoint, CWS 심사
- `apps/extension/scripts/updateVersion.js`: release version bump
- `apps/extension/src/background/handlers/oauth.ts`: auth code/token handling
- `apps/extension/src/apis/client.ts`: auth interceptor와 silent reauth
- `apps/extension/src/apis/external/`: 외부 markup/API 변화에 민감한 parser
- `apps/extension/src/utils/templateStorage.ts`: local draft migration risk
- `apps/web/auth.ts`: Auth.js provider와 session contract
- `apps/web/app/api/`: backend proxy/BFF 경계와 인증 검사
- `apps/web/app/[locale]/`: locale routing, metadata, indexability
- `.github/workflows/`: Vercel, Chrome Web Store, GitHub Release 자동화

## 검증 기준

코드를 수정했다면 최소한 아래를 실행하세요.

```bash
pnpm lint
pnpm typecheck
pnpm build
```

UI 변경은 웹 브라우저에서 주요 locale, 링크, 인증 fallback, responsive layout을
검증하세요. 확장 프로그램 UI 또는 Chrome API 동작을 변경했다면
`pnpm build:extension:local` 후 unpacked extension으로 popup, storage, badge,
OAuth/service-worker 관련 흐름을 확인하세요.

실제 Google OAuth, Vercel, Chrome Web Store, legacy backend 검증은 각각의
credential이 필요합니다. credential이 없는 상태에서 성공했다고 보고하지 말고,
로컬 placeholder build와 외부 연동 검증을 구분해서 기록하세요.
