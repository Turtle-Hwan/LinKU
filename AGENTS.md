# AGENTS.md

이 문서는 LinKU에서 작업하는 코딩 에이전트를 위한 빠른 진입점입니다.
설계, 동작, 배포, 협업 규칙이 관련된 작업이라면 이 문서를 먼저 읽고,
이후 `docs/ARCHITECTURE.md`와 `docs/CONTRIBUTING.md`를 확인하세요.

## 프로젝트 개요

LinKU는 건국대학교 학생을 위한 Manifest V3 Chrome Extension입니다.
팝업 UI에서 학교 및 학생 서비스 링크, 공지, todo, banner, template 편집과
공유, 도서관 좌석 현황, QR 생성 같은 Labs 기능을 제공합니다.

이 저장소는 프론트엔드 확장 프로그램 코드만 포함합니다. LinKU backend와의
통신은 `VITE_API_BASE_URL`을 기준으로 이루어지며, 학교 및 외부 사이트 접근은
`public/manifest.json`의 `host_permissions`가 제어합니다.

## 읽는 순서

1. `README.md`: 제품 소개와 기본 실행 명령을 확인합니다.
2. `docs/ARCHITECTURE.md`: 런타임 구조, 소스 지도, 데이터 흐름을 파악합니다.
3. `docs/CONTRIBUTING.md`: 브랜치, PR, 검증, 릴리즈 규칙을 확인합니다.
4. 위 문맥을 이해한 뒤 관련 source file을 읽습니다.

## 런타임 구성

- Popup UI: `index.html` -> `src/main.tsx` -> `src/routes.tsx`
- Root app shell: `src/App.tsx`
- Background service worker: `src/background/index.ts`
- OAuth handler: `src/background/handlers/oauth.ts`
- Extension manifest: `public/manifest.json`

현재 구조에는 content script가 없습니다. `public/manifest.json`이 변경되지 않는
한 페이지 주입 기능이 존재한다고 가정하지 마세요.

## 공통 명령

```bash
pnpm install
pnpm run dev
pnpm run build:local
pnpm run lint
```

Chrome에서 확장 프로그램을 검증하기 전에는 `pnpm run build:local`을 실행하고,
생성된 `dist/` 디렉터리를 `chrome://extensions`에서 Developer Mode로
로드하세요.

`pnpm run dev`는 React UI 반복 작업에는 유용하지만, `chrome.identity`,
`chrome.storage`, `chrome.action`, service worker 동작은 빌드된 확장 프로그램
환경에서 검증해야 합니다.

## 변경 규칙

- `public/manifest.json`의 extension version을 직접 수정하지 마세요.
  운영 workflow가 `scripts/updateVersion.js`를 통해 version을 올립니다.
- Chrome permission을 추가하거나 넓힐 때는 해당 permission이 왜 필요한지
  문서화하세요.
- `host_permissions`는 보안상 민감한 영역입니다. 가능한 한 넓은 패턴보다
  구체적인 domain을 사용하세요.
- access token, refresh token, auth code, private user data를 로그로 남기지
  마세요.
- `README.md`는 제품 소개와 빠른 시작 중심으로 유지하세요. 협업 및 기술
  세부사항은 `docs/` 아래에 둡니다.
- 이미 working tree에 존재하는 사용자 변경사항을 보존하세요. 편집 전
  `git status`를 확인하세요.

## 소스 책임 지도

- `src/components/Tabs/`: popup tab 기능.
- `src/components/Editor/`: template editor control과 canvas.
- `src/pages/`: route 단위 page.
- `src/layouts/`: route layout wrapper.
- `src/contexts/`: React Context 기반 상태 container.
- `src/hooks/`: feature 단위 hook.
- `src/apis/`: LinKU backend API wrapper.
- `src/apis/external/`: 학교 또는 외부 서비스 연동.
- `src/background/`: Manifest V3 service worker와 message handling.
- `src/utils/`: storage, auth, analytics, template, Chrome helper utility.
- `src/types/`: 공유 TypeScript data contract.
- `src/constants/`: link list 같은 정적 app data.

## 주의 영역

- `public/manifest.json`: permission, entrypoint, Chrome Web Store 심사에
  직접 영향을 줍니다.
- `scripts/updateVersion.js`: release automation과 version bump에 관여합니다.
- `.github/workflows/`: Chrome Web Store upload, GitHub Pages, release 흐름을
  제어합니다.
- `src/background/handlers/oauth.ts`: auth flow와 token handling을 담당합니다.
- `src/apis/client.ts`: auth interceptor, backend response parsing,
  silent reauth를 담당합니다.
- `src/apis/external/`: third-party 또는 school page markup에 의존하는 parsing
  logic이 있습니다.
- `src/utils/templateStorage.ts`: local draft persistence와 migration risk가
  있습니다.

## 검증 기준

code change라면 최소한 다음 명령을 실행하세요.

```bash
pnpm run build:local
```

TypeScript, React hooks, shared utilities, CI/lint configuration을 수정했다면
`pnpm run lint`도 실행하세요. 기존 lint issue 때문에 실패한다면 최종 보고에
명확히 적고, 관련 없는 실패를 숨기지 마세요.

UI 또는 확장 프로그램 동작을 변경했다면 `dist/`를 Chrome에 직접 로드해 관련
popup 흐름을 검증하세요. OAuth, storage, badge, service-worker 변경은 Vite
dev mode와 실제 extension runtime이 다르므로 브라우저 검증이 필요합니다.

