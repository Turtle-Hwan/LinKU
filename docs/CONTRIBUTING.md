# 기여 가이드

이 문서는 LinKU의 확장 프로그램 release flow를 깨뜨리지 않고, 이후 유지보수가
가능한 방식으로 협업하기 위한 기준을 설명합니다.

## 시작하기 전에

LinKU는 Chrome Web Store를 통해 배포되는 실제 Chrome Extension입니다.
변경사항은 review 가능한 크기로 유지하고, 사용자 영향, permission,
authentication, release automation에 미치는 영향을 명확히 드러내야 합니다.

feature proposal, behavior change, permission change, 큰 refactor는 먼저
GitHub Issues에서 논의하세요. 의도가 분명한 작은 bug fix와 documentation
improvement는 바로 PR로 진행해도 됩니다.

## 프로젝트 빠른 이해

LinKU는 건국대학교 학생을 위한 Manifest V3 Chrome Extension입니다. 교내 공식
사이트, 학생 제작 서비스, 공지, todo, template, Labs 기능을 하나의 popup에서
사용할 수 있게 합니다.

현재 구조에는 content script가 없습니다. `public/manifest.json`은 popup UI와
Background service worker를 선언하며, 방문 중인 페이지에 script를 주입하지
않습니다. popup과 Background service worker 사이의 통신은
`chrome.runtime.sendMessage`와 `src/background/types.ts`의 type guard를 통해
이루어집니다.

기술 스택은 다음을 기준으로 이해하면 됩니다.

- Build: Vite 8, `@vitejs/plugin-react-swc`
- UI: React 19, TypeScript 6, Tailwind CSS 4, shadcn/ui, Radix UI
- Routing: `react-router-dom` v7, hash routing
- State: 별도 전역 상태 라이브러리 없이 React Context 사용
- Extension runtime: Manifest V3, Background service worker
- Package manager/runtime: pnpm, Node.js 24 LTS
- Supporting libraries: `@dnd-kit/*`, `embla-carousel`, `cmdk`, `sonner`,
  `lucide-react`, `react-error-boundary`

## 코드베이스 빠른 지도

주요 디렉터리 역할은 다음과 같습니다.

- `src/background/`: MV3 Background service worker, OAuth, badge update.
- `src/pages/`: route 단위 page. Main, Editor, TemplateList, Gallery,
  NotFound가 여기에 있습니다.
- `src/components/Tabs/`: main popup tab 기능. link group, todo, alerts,
  carousel 등이 여기에 모입니다.
- `src/components/Editor/`: template editor UI, canvas, sidebar, header.
- `src/components/Labs/`: 실험 기능. library seat, QR generator, server clock.
- `src/components/ui/`: shadcn/ui 스타일의 Radix UI wrapper.
- `src/contexts/`: React Context 기반 상태 관리. `EditorContext.tsx`가
  template editor 상태의 중심입니다.
- `src/apis/`: LinKU backend API wrapper와 endpoint 정의.
- `src/apis/external/`: eCampus, library, RSS, HTML parsing, banners 같은
  외부 또는 학교 사이트 연동.
- `src/utils/`: analytics, chrome, crypto, oauth, template, templateStorage
  등 cross-cutting utility.
- `src/constants/`: `LinkList.ts` 같은 정적 app data.
- `src/types/`: backend response와 domain model의 TypeScript contract.

더 자세한 runtime 구조와 데이터 흐름은 `docs/ARCHITECTURE.md`를 기준으로
확인하세요.

## 로컬 설정

```bash
pnpm install
pnpm run dev
```

`pnpm run dev`는 React UI를 빠르게 확인할 때 사용합니다. 이 환경은 Chrome
확장 프로그램 runtime을 완전히 재현하지 않습니다.

확장 프로그램 검증에는 다음 명령을 사용합니다.

```bash
pnpm run build:local
```

이후 `chrome://extensions`를 열고 Developer Mode를 활성화한 뒤, 생성된
`dist/` 디렉터리를 unpacked extension으로 로드하세요.

## 환경 변수

`.env.development.example`을 복사해 `.env.development`를 만듭니다.

중요한 변수:

- `VITE_API_BASE_URL`: LinKU backend API base URL입니다. auth, templates,
  icons, alerts, public gallery data 같은 backend-backed feature에 필요합니다.
- `VITE_GA_API_SECRET`: Google Analytics Measurement Protocol secret입니다.
  analytics 동작을 검증하지 않는 대부분의 local development에서는 필수는
  아닙니다.
- `VITE_ENVIRONMENT`: analytics 동작에서 사용하는 environment flag입니다.

`VITE_API_BASE_URL`이 없거나 placeholder 값으로 남아 있으면, local build를
해도 Google OAuth login과 `src/apis/` 기반 backend API 검증은 정상적으로
진행되지 않습니다. auth, templates, icons, alerts 같은 기능을 확인하려면
실제 backend URL이 필요합니다.

실제 secret을 commit하지 마세요. `.env.*` 파일은 example file을 제외하고
ignore됩니다.

## 브랜치 전략

이 저장소는 `main`을 통합 branch로 사용합니다.

권장 branch prefix:

- `feat/*`: 사용자에게 보이는 feature.
- `fix/*`: bug fix.
- `refactor/*`: 동작을 유지하는 code change.
- `docs/*`: documentation.
- `config/*` 또는 `ci/*`: tooling과 workflow change.

branch는 하나의 목적에 집중하세요. feature work, formatting churn, 관련 없는
cleanup을 한 PR에 섞지 않는 것이 좋습니다.

## 커밋 스타일

가능하면 Conventional Commits를 사용합니다.

- `feat: add template gallery filter`
- `fix(auth): handle expired token response`
- `refactor(editor): split canvas helpers`
- `docs: add architecture guide`
- `ci: add lint check`

현재 commitlint 또는 Husky enforcement는 없습니다. 따라서 commit style은
local gate가 아니라 review convention입니다.

## PR 체크리스트

review 요청 전 다음 내용을 포함하세요.

- behavior 또는 documentation change 요약.
- visible UI change가 있다면 screenshot 또는 GIF.
- extension-only behavior에 대한 manual test notes.
- backend API assumption 또는 response-shape change.
- permission change가 있다면 각 permission이 필요한 이유.
- verification command의 실행 결과 또는 상태.

권장 local check:

```bash
pnpm run build:local
pnpm run lint
```

현재 CI는 PR에서 `pnpm run build:local`을 실행합니다. shared code, React hooks,
TypeScript utility를 변경했다면 가능한 한 local에서 lint도 실행하세요.

현재 프로젝트에는 Prettier, Stylelint, Husky, lint-staged, test framework,
pre-commit hook이 없습니다. formatting과 test coverage는 자동으로 보장되지
않으므로, 변경 범위에 맞는 manual verification을 PR 설명에 남기는 것이
중요합니다.

## 수동 테스트 가이드

layout과 interaction을 빠르게 확인할 때는 `pnpm run dev`를 사용하고, runtime
behavior는 빌드된 extension으로 검증합니다.

다음 영역을 수정했다면 unpacked extension으로 검증하세요.

- `src/background/`
- `src/utils/chrome.ts`
- `src/utils/oauth.ts`
- `src/apis/client.ts`
- `public/manifest.json`
- storage behavior
- OAuth behavior
- badge updates
- host permissions
- external school-site integrations

UI change는 popup viewport size와 영향을 받는 route를 확인하세요. template
editor change는 관련 범위에 따라 create, edit, save locally, sync, drag,
resize, template list로 돌아가는 navigation을 확인하세요.

## 아키텍처 경계

현재 source boundary를 따르세요.

- Route-level screen은 `src/pages/`에 둡니다.
- Layout wrapper는 `src/layouts/`에 둡니다.
- Reusable UI primitive는 `src/components/ui/`에 둡니다.
- Main popup feature section은 `src/components/Tabs/`에 둡니다.
- Template editor component는 `src/components/Editor/`에 둡니다.
- Backend API wrapper는 `src/apis/`에 둡니다.
- External school 또는 third-party integration은 `src/apis/external/`에 둡니다.
- Shared type contract는 `src/types/`에 둡니다.
- Cross-cutting browser와 data utility는 `src/utils/`에 둡니다.
- MV3 background code는 `src/background/`에 둡니다.

feature PR 안에서 새로운 state library, router, styling system, formatter,
test framework를 도입하지 마세요. 그런 변경은 별도 tooling decision PR로
다루는 것이 좋습니다.

## Chrome 권한 정책

permission change는 추가 검토가 필요합니다.

`public/manifest.json`을 수정할 때는 다음을 설명하세요.

- 어떤 feature가 해당 permission을 필요로 하는지.
- 어떤 API 또는 domain이 해당 permission을 요구하는지.
- 더 좁은 permission으로 충분하지 않은 이유.
- Chrome에서 해당 behavior를 어떻게 manual test했는지.

넓은 access보다 domain-specific `host_permissions`를 선호하세요. `<all_urls>`는
legacy 또는 temporary permission으로 보고, 가볍게 확장하지 마세요.

## 로깅 규칙

runtime log는 필요한 최소한만 남기고, 정책은 `src/utils/logger.ts`를 기준으로
일관되게 적용합니다.

- `console.log`, `console.warn`, `console.error`, `console.info`를 직접 호출하지
  말고 공통 logger를 사용하세요.
- `debug`/`info` 수준 로그는 개발 환경에서만 출력되도록 유지하세요.
- 운영 환경에는 장애 원인 파악에 필요한 `warn`/`error`만 남기고, 동일한 실패를
  여러 계층에서 중복 기록하지 마세요.
- access token, refresh token, auth code, secret, authorization header,
  private user data 같은 민감정보를 로그에 남기지 마세요.
- 외부 응답 본문이나 큰 object 전체 dump 대신, 상태 코드와 비민감 핵심 필드만
  선택적으로 기록하세요.

## 외부 사이트 연동

`src/apis/external/` 아래 파일은 external markup 또는 API에 의존합니다. 이
영역을 변경할 때는 무엇을 검증했는지 문서화하세요.

- Target URL 또는 service.
- Verification date.
- Example response 또는 DOM assumption.
- Parsing 실패 시 fallback behavior.

이 integration들은 학교 또는 외부 사이트가 구조를 바꾸면 코드 변경 없이도
깨질 수 있습니다.

## 첫 기여 흐름

처음 기여한다면 다음 순서로 진행하세요.

1. GitHub Issue에서 변경 의도와 범위를 확인하거나 제안합니다.
2. `feat/*`, `fix/*`, `refactor/*`, `docs/*`, `config/*`, `ci/*` 중 적절한
   branch prefix로 작업 branch를 만듭니다.
3. 관련 source와 `docs/ARCHITECTURE.md`를 읽고 변경 위치를 좁힙니다.
4. 코드를 수정하고 `pnpm run build:local`을 실행합니다.
5. 가능하면 `pnpm run lint`도 실행합니다.
6. `dist/`를 Chrome에 로드해 실제 extension 동작을 확인합니다.
7. PR에 변경 요약, 검증 결과, UI 변경 screenshot/GIF, permission 변경 사유를
   남깁니다.

실제 사용자가 있는 확장 프로그램이므로 “브라우저에서 직접 확인했다”는 기록은
review에서 중요합니다.

## 릴리즈와 버전 관리

일반 PR에서 `public/manifest.json`의 version을 직접 bump하지 마세요.

main-branch workflow가 다음을 처리합니다.

- Chrome Web Store draft upload.
- GitHub Release creation.
- GitHub Pages deployment.
- `scripts/updateVersion.js`를 통한 manifest patch version bump.

release workflow가 `chore: bump version ... [skip ci]` commit을 생성했다면,
release process 자체를 고치는 경우가 아니라면 amend하거나 rebase로 제거하지
마세요.

## 문서화 규칙

`README.md`는 product overview와 quick start 중심으로 유지합니다.

용도별 문서:

- `docs/ARCHITECTURE.md`: runtime design과 technical map.
- `docs/CONTRIBUTING.md`: collaboration rule.
- `AGENTS.md`: AI coding-agent orientation.

architecture, workflow, permission, environment variable, onboarding step을
변경했다면 같은 PR에서 documentation도 갱신하세요.
