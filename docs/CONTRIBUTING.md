# 기여 가이드

LinKU는 실제 사용자가 설치하는 Chrome Extension입니다. 사용자 데이터, permission,
인증과 release에 미치는 영향을 작고 검증 가능한 변경으로 제출해 주세요.

## 개발 환경

```bash
pnpm install
cp .env.development.example .env.development
pnpm run dev
```

`pnpm run dev`는 React UI 반복 작업용입니다. MV3 service worker, `chrome.identity`,
extension storage가 관련된 변경은 반드시 빌드된 확장에서 확인합니다.

```bash
pnpm run build:local
# dist/를 chrome://extensions에서 unpacked extension으로 로드
```

## Supabase 로컬 개발

Docker가 실행 중인 상태에서 다음 명령으로 Postgres/Auth/Storage를 시작합니다.

```bash
pnpm exec supabase start
pnpm exec supabase status
pnpm exec supabase db reset
pnpm exec supabase db lint --level warning
pnpm exec supabase test db
pnpm run test:supabase-assets
pnpm exec supabase stop
```

`db reset`은 로컬 DB 데이터를 초기화합니다. 보존할 데이터가 있으면 먼저 백업하고,
이 개발 절차에 운영 DB 연결이나 `--linked`를 사용하지 마세요. `start`·`status` 출력에는
로컬 비밀 키도 포함될 수 있으므로 전체 출력을 PR·로그·스크린샷에 붙이지 않습니다.

`supabase status`의 API URL과 publishable key를 `.env.development`의
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`에 넣습니다. 두 값은 공개 client
설정이며 service-role key를 사용하면 안 됩니다.

schema를 변경하면 로컬 DB에 migration을 적용하고 `pnpm exec supabase gen types typescript --local`의
결과로 `src/types/supabase.ts`를 갱신한 뒤 pgTAP을 실행합니다. 생성 타입을 별도로 추측해 고치지 않습니다.

DB/RLS/Storage policy 테스트에는 Google credential이 필요하지 않습니다. 실제 OAuth를
검증할 때만 Supabase Auth에 Google provider를 켜고 로컬 unpacked extension의
`https://<extension-id>.chromiumapp.org/supabase` redirect URL을 allowlist에 추가합니다.
Google client ID/secret은 로컬 ignored environment 또는 Supabase provider 설정에만
두고 `VITE_` 변수, source, fixture나 문서에 값을 기록하지 않습니다.
Google Cloud의 Authorized redirect URI에는 chromiumapp URL이 아니라 Supabase Dashboard가
표시하는 `/auth/v1/callback` URL을 등록합니다.

`test:supabase-assets`는 loopback 주소에서만 실행하며 임시 사용자와 로컬 서명 claim으로
실제 REST/Storage API의 CRUD·소유권·참조 경합·물리 파일 삭제를 확인한 뒤 fixture를 정리합니다.
Email provider를 켜지 않고 실행할 수 있으며 실제 Google 로그인 검증을 대신하지 않습니다.
격리된 CLI 작업 폴더는 `--workdir <local-test-directory>`로 지정할 수 있습니다.

기본 로컬 설정은 Google provider가 꺼져 있습니다. 실제 OAuth를 로컬에서 검증할 때는
로컬 전용 Supabase 설정에서 Google provider를 켜고 CLI 실행 환경에 `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`을 제공합니다. Supabase의 redirect allowlist에는 로컬 unpacked ID와
서비스 확장 ID의 `/supabase` URL을 각각 등록해야 하며, 실제 값과 개인 설정은 커밋하지 않습니다.

운영 Supabase에도 email/phone/anonymous signup은 끄고 Google provider만 활성화해야
합니다. Google nonce 검증은 끄지 않습니다. DB의 RLS/RPC도 JWT의 Google provider를
검사하지만 provider 설정은 배포 전 수동 gate입니다.

## 변경 원칙

- 하나의 branch·PR은 한 목적에 집중하고, 기존 사용자 변경과 저장 데이터는 보존합니다.
- [Architecture](ARCHITECTURE.md)의 소스 경계와 [AGENTS.md](../AGENTS.md)의 component 조합 규칙을 따릅니다.
- 외부 API·DOM parser의 수집 범위와 fallback을 명확히 하고 실패가 데이터 손실로 이어지지 않게 합니다.
- IndexedDB 쓰기 성공과 원격 동기화 결과를 분리합니다.
- schema 변경은 기존 store와 record를 보존하는 additive upgrade로 작성합니다.
- SQL schema 변경은 migration, generated TypeScript type와 pgTAP을 함께 갱신합니다.
- public gallery 응답에 email, Google profile, owner ID나 private document를 넣지 않습니다.
- permission과 `host_permissions`는 필요한 범위보다 넓히지 않습니다.
- access/refresh token, auth code, PKCE verifier, secret, cookie, template JSON과 icon
  bytes를 로그로 남기지 않습니다.
- 예상 가능한 offline, conflict, validation과 RLS 결과는 toast/breadcrumb로 처리하고
  예상 밖 contract/storage 오류만 한 경계에서 Sentry에 수집합니다.
- 새 상태 관리·UI·test framework는 feature 변경과 함께 도입하지 않습니다.
- `console.*` 대신 공통 logger를 사용하고, 외부 응답 전체가 아닌 상태 코드·비민감 맥락만 기록합니다.

## 공개 설정과 비밀값

Supabase URL·publishable key와 Sentry browser DSN은 공개 client 설정입니다.
`sb_secret_*`·`service_role`·DB 비밀번호·Google client secret·Sentry auth token은
소스·fixture·문서·`VITE_` 변수에 넣지 않습니다. 개인 자격증명·발급 기록·운영 메모는
Git에서 제외된 로컬 파일에만 두고, 비밀값 파일의 접근 권한도 제한합니다.

GA의 `VITE_GA_API_SECRET`은 direct 전송을 위해 확장 번들에 포함하는 명시적인 예외입니다.
노출 위험과 실패 정책은 [GA4 Data Taxonomy](GA4-Data-Taxonomy.md)를 따릅니다.

PR 전에는 변경 파일뿐 아니라 커밋 이력·빌드 산출물·PR 설명·첨부물도 검사하고,
검사 결과에 원문 비밀값을 출력하지 않습니다. 빌드/client는 공개 publishable/anon 키만
허용하고, 인증 adapter는 저장소 접근 제한에 실패하면 읽기·쓰기를 중단합니다. 이 검사는
전체 비밀값 검사를 대체하지 않으므로 설정·산출물을 확인하고 로그에 토큰을 전달하지 마세요.

## 검증

모든 code change는 최소 다음 명령을 실행합니다.

```bash
pnpm run lint
pnpm run build:local
```

변경 영역에 따라 관련 테스트를 추가합니다.

```bash
pnpm run test:templates
pnpm run test:timetable
pnpm run test:alerts
pnpm run test:monitoring
pnpm run build:gh-pages
pnpm exec supabase test db
```

빌드된 MV3 runtime smoke test는 임시 Chromium profile을 사용합니다.
`test:extension`은 테스트 전용 Supabase 설정으로 빌드하고 OAuth 응답을 대체하므로
운영 프로젝트나 Google credential 없이 실행할 수 있습니다. 실제 로그인을 확인하려면
로컬 환경값을 설정한 뒤 `pnpm run build:local`로 다시 빌드합니다.

```bash
pnpm exec playwright install --no-shell chromium
pnpm run test:extension
```

`tests/extension/extension.fixture.ts`는 임시 Chromium에 확장을 로드하고 background worker를
찾아 종료 시 context를 정리합니다. 사용자 Chrome 프로필·설치본은 변경하지 않습니다.
`smoke.spec.ts`는 popup 로딩, `features/*.spec.ts`는 기능별 동작을 검증합니다.
특정 spec은 Playwright 경로 인자로 선택하고, 화면을 보려면 `LINKU_E2E_HEADED=1`을 사용합니다.
테스트별 package script를 늘리지 않습니다.

- UI: 실제 popup 크기, 키보드 조작, loading·empty·error 상태를 확인합니다.
- 외부 parser: 실제 응답과 fallback을 확인하되 로그인 정보·응답 원문을 fixture로 남기지 않습니다.
- Permission: API/domain을 최소 범위로 유지하고 확장 런타임에서 검증합니다.
- 배너: `startAt`/`endAt`은 timezone이 있는 ISO 8601로 작성합니다. 긴급 중단은 구형 확장도
  고려해 목록에서 제거하되 캐시가 갱신되기 전까지 즉시 사라짐을 보장하지 않습니다.

실제 Google 계정 선택과 운영 Supabase RLS는 local/mock 테스트와 구분해 PR에 기록합니다.
테스트하지 못한 범위와 기존 실패를 숨기지 마세요.

서버 RPC 계약을 바꾸는 migration은 확장 release 전에 대상 Supabase에 적용합니다.
release workflow는 공개 갤러리 응답과 새 게시 RPC의 익명 접근 거부를 확인하며, schema가
이전 버전이거나 익명 쓰기가 허용되면 Web Store draft 업로드를 중단합니다.

PR CI는 lint, extension build, local-first template, monitoring, analytics와 시간표 계약을
검사하고 Pages도 별도 진입점으로 빌드합니다. Chromium 설치가 필요한 MV3 Playwright,
Docker 기반 Supabase pgTAP·실제 Storage API 검증과 전체 기능 회귀는 관련 변경에서
로컬로 실행하고 결과를 PR에 기록합니다. `main`의 Pages 빌드·배포도 유지됩니다.

## PR과 릴리즈

커밋은 가장 작은 coherent unit으로 나누고 Conventional Commits 형식을 권장합니다.
PR에는 목적·사용자 영향, 외부 응답 가정, migration·데이터 보존 영향, permission 변경 사유,
검증 명령·결과와 미검증 범위를 적습니다. UI 변경은 popup 크기의 screenshot이나 GIF를 첨부합니다.

일반 PR에서 `public/manifest.json` version을 수정하지 않습니다. `main` workflow가
Chrome Web Store draft, GitHub Release, Pages 배포와 version bump를 담당합니다.
draft 업로드 성공은 사용자 배포 완료가 아닙니다. Chrome Web Store 심사 제출과 공개는
별도 단계이며, 실제 Google 로그인·운영 게시·복제·다기기 동기화 검증과 구분합니다.

architecture·permission·workflow·onboarding이 바뀌면 같은 PR에서 관련 문서를 갱신합니다.

- `README.md`: 제품 소개와 빠른 시작
- `docs/ARCHITECTURE.md`: 런타임과 데이터 경계
- `docs/LOCAL_FIRST.md`: 저장·동기화 계약
- `docs/OBSERVABILITY.md`: Sentry 정책
- `docs/GA4-Data-Taxonomy.md`: 분석 이벤트 계약과 구현 상태
- `AGENTS.md`: 코딩 에이전트 진입점
