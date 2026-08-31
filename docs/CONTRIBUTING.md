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
pnpm exec supabase stop
```

`supabase status`의 API URL과 publishable key를 `.env.development`의
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`에 넣습니다. 두 값은 공개 client
설정이며 service-role key를 사용하면 안 됩니다.

DB/RLS/Storage policy 테스트에는 Google credential이 필요하지 않습니다. 실제 OAuth를
검증할 때만 Supabase Auth에 Google provider를 켜고 로컬 unpacked extension의
`https://<extension-id>.chromiumapp.org/supabase` redirect URL을 allowlist에 추가합니다.
Google client ID/secret은 로컬 ignored environment 또는 Supabase provider 설정에만
두고 `VITE_` 변수, source, fixture나 문서에 값을 기록하지 않습니다.
Google Cloud의 Authorized redirect URI에는 chromiumapp URL이 아니라 Supabase Dashboard가
표시하는 `/auth/v1/callback` URL을 등록합니다.

운영 Supabase에도 email/phone/anonymous signup은 끄고 Google provider만 활성화해야
합니다. Google nonce 검증은 끄지 않습니다. DB의 RLS/RPC도 JWT의 Google provider를
검사하지만 provider 설정은 배포 전 수동 gate입니다.

## 변경 원칙

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

```bash
pnpm exec playwright install --no-shell chromium
pnpm run test:extension
```

실제 Google 계정 선택과 운영 Supabase RLS는 local/mock 테스트와 구분해 PR에 기록합니다.
테스트하지 못한 범위와 기존 실패를 숨기지 마세요.

PR CI는 매 변경에 필요한 lint, extension build, local-first template과 monitoring 계약만
검사합니다. Chromium 설치가 필요한 MV3 Playwright, Docker 기반 Supabase pgTAP과 전체
기능 회귀는 관련 변경에서 로컬로 실행하고 결과를 PR에 기록합니다. GitHub Pages는 실제
배포 workflow에서 다시 빌드하므로 일반 PR에서 중복 빌드하지 않습니다.

## PR과 릴리즈

커밋은 가장 작은 coherent unit으로 나누고 PR에는 사용자 영향, migration, permission,
검증 결과를 적습니다. UI 변경은 popup 크기의 screenshot이나 GIF를 첨부합니다.

일반 PR에서 `public/manifest.json` version을 수정하지 않습니다. `main` workflow가
Chrome Web Store draft, GitHub Release, Pages 배포와 version bump를 담당합니다.

- `README.md`: 제품 소개와 빠른 시작
- `docs/ARCHITECTURE.md`: 런타임과 데이터 경계
- `docs/LOCAL_FIRST.md`: 저장·동기화 계약
- `docs/OBSERVABILITY.md`: Sentry 정책
- `AGENTS.md`: 코딩 에이전트 진입점
