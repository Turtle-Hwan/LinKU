# AGENTS.md

이 문서는 LinKU에서 작업하는 코딩 에이전트를 위한 빠른 진입점입니다.
설계, 동작, 배포, 협업 규칙이 관련된 작업이라면 이 문서를 먼저 읽고,
이후 `docs/ARCHITECTURE.md`와 `docs/CONTRIBUTING.md`를 확인하세요.

## 프로젝트 개요

LinKU는 건국대학교 학생을 위한 Manifest V3 Chrome Extension입니다.
팝업 UI에서 학교 및 학생 서비스 링크, 공지, todo, banner, template 편집과
게시, 도서관 좌석 현황, QR 생성 같은 Labs 기능을 제공합니다.

이 저장소는 확장 프로그램과 Supabase schema를 함께 포함합니다. 계정 동기화와
커뮤니티는 `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`를 사용하고,
학교 및 외부 사이트 접근은 `public/manifest.json`의 `host_permissions`가
제어합니다.

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
- Everytime timetable content script: `src/content/everytime-timetable.ts`
- Extension manifest: `public/manifest.json`

content script는 에브리타임 시간표 HTML 파싱에만 사용됩니다. 새 페이지 주입
기능을 추가할 때는 `public/manifest.json`의 구체적인 match pattern과 데이터
경계를 함께 검토하세요.

## 공통 명령

```bash
pnpm install
pnpm run dev
pnpm run build:local
pnpm run lint
pnpm run test:templates
pnpm run test:timetable
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

## 컴포넌트 조합 규칙

- 로딩·빈 상태·저장 후 상태·다이얼로그처럼 하나의 feature가 여러 화면 역할로
  나뉘면, compound component를 기본으로 사용하세요. 예: `TimeTable.Loading`,
  `TimeTable.Empty`, `TimeTable.Saved`.
- root component는 상태, side effect, 이벤트 연결을 담당하고, 하위 component는
  역할이 드러나는 이름과 명시적인 props로 화면을 담당합니다. root의 긴 조건부
  JSX와 중복 action UI를 줄이는 것이 목적입니다.
- 외부 consumer가 하위 component를 조합해야 한다면 `Object.assign` 등으로
  export된 component에도 정적 멤버를 보존하세요. 한 파일 안에서만 조합한다면
  기존 `MainLayout.Header`, `LinkGroup.Grid` 관례를 따릅니다.
- 단일 역할의 작고 독립적인 UI까지 compound component로 감싸지는 마세요.
  독립 재사용이 필요한 경우에는 일반 component를 우선합니다.

## 소스 책임 지도

- `src/components/Tabs/`: popup tab 기능.
- `src/components/Editor/`: template editor control과 canvas.
- `src/pages/`: route 단위 page.
- `src/layouts/`: route layout wrapper.
- `src/contexts/`: React Context 기반 상태 container.
- `src/hooks/`: feature 단위 hook.
- `src/apis/supabase/`: Auth, account sync와 community adapter.
- `src/apis/external/`: 학교 또는 외부 서비스 연동.
- `src/storage/`: IndexedDB schema와 feature별 repository.
- `src/sync/`: 로컬 template과 cloud document 변환.
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
- `src/background/handlers/timetable.ts`: Everytime tab 탐색, 로그인 재개,
  수동 학기 묶음 import orchestration을 담당합니다.
- `src/content/everytime-timetable.ts`: Everytime 시간표 XML을 구조화하고 API
  실패 시 DOM을 파싱하며 password, cookie, session token은 읽거나 저장하지 않습니다.
- `src/utils/everytimeTimetable.ts`: Everytime 원본 snapshot과 사용자 override를
  병합하는 side-effect 없는 도메인 로직을 담당합니다.
- `src/utils/timetableStorage.ts`: snapshot asset과 별도 override index의 저장,
  schema migration, 삭제 시 정리를 담당합니다.
- `src/apis/supabase/client.ts`: publishable configuration, PKCE session과
  `chrome.storage.local` adapter를 담당합니다.
- `src/apis/external/`: third-party 또는 school page markup에 의존하는 parsing
  logic이 있습니다.
- `src/storage/templates/repository.ts`: local template persistence와 migration
  risk가 있습니다.
- `src/storage/account/syncRepository.ts`: outbox race와 account binding을
  담당합니다.

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
