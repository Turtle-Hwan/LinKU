# 기여 가이드

LinKU는 실제 사용자가 설치하는 Chrome Extension입니다. 변경 범위를 작게 유지하고
사용자 데이터, permission, 인증, release 흐름에 미치는 영향을 명확히 드러내세요.

## 시작하기

```bash
pnpm install
pnpm run dev
```

`pnpm run dev`는 React UI 확인용입니다. Chrome extension runtime 검증에는 다음
명령으로 만든 `dist/`를 `chrome://extensions`에서 로드합니다.

```bash
pnpm run build:local
```

backend 기능에는 유효한 `VITE_API_BASE_URL`이 필요합니다. 실제 secret은 commit하지
마세요.

## 작업 원칙

- 하나의 branch와 PR은 하나의 목적에 집중합니다.
- 기존 working tree의 사용자 변경과 저장된 데이터의 하위 호환성을 보존합니다.
- route, feature, external API, background 책임은 `docs/ARCHITECTURE.md`의 소스
  경계를 따릅니다.
- 외부 API·DOM parser는 수집 범위와 fallback을 명확히 하고 실패를 사용자 데이터
  손실로 이어지게 하지 않습니다.
- feature PR에서 새로운 state library, router, styling system, formatter, test
  framework를 함께 도입하지 않습니다.
- loading·empty·saved·dialog처럼 하나의 feature 화면이 여러 역할로 나뉘면
  compound component를 우선 검토합니다.

커밋은 가능한 한 작은 단위로 나누고 Conventional Commits 형식을 권장합니다.

```text
feat: add user-facing behavior
fix(auth): handle expired token
refactor(editor): split canvas helpers
docs: update contributor guide
```

## 검증

모든 code change는 최소한 다음을 통과해야 합니다.

```bash
pnpm run build:local
```

TypeScript, React hook, shared utility를 수정했다면 lint를 실행합니다. 시간표 도메인
로직을 수정했다면 전용 회귀 테스트도 실행합니다.

```bash
pnpm run lint
pnpm run test:timetable
```

변경 유형별 추가 확인:

- UI: 실제 popup 크기에서 layout, keyboard, loading/error 상태.
- Background, storage, OAuth, badge: 빌드된 unpacked extension.
- 외부 사이트 parser: 실제 페이지·응답과 fallback. 로그인 정보나 원문 응답을
  로그 또는 fixture에 남기지 않습니다.
- Permission: 추가된 API/domain이 최소 범위인지 확인합니다.
- 배너 운영 기간: `startAt`/`endAt`에 timezone이 포함된 ISO 8601 값을 사용하고,
  즉시 내려야 하는 배너는 이전 확장도 고려해 목록에서 제거합니다.

테스트하지 못한 범위와 기존 실패는 PR 설명에 명시합니다.

## PR 체크리스트

- 변경 목적과 사용자 영향 요약.
- 실행한 검증 명령과 수동 확인 결과.
- UI 변경의 screenshot 또는 GIF.
- backend·외부 응답 shape 가정.
- permission 변경 사유와 실제 extension 검증 방법.
- migration 또는 사용자 데이터 보존 영향.

## 보안과 로깅

- `host_permissions`는 domain 단위로 최소화하고 `<all_urls>`를 새로 사용하지
  않습니다.
- access/refresh token, auth code, secret, authorization header, cookie, private
  user data를 로그에 남기지 않습니다.
- `console.*` 대신 `src/utils/logger.ts`를 사용하고 production에는 필요한
  warn/error만 남깁니다.
- 외부 응답 전체보다 상태 코드와 비민감 핵심 필드만 기록합니다.

## 릴리즈와 문서

일반 PR에서 `public/manifest.json` version을 직접 수정하지 않습니다. main의
workflow가 Chrome Web Store draft, GitHub Release, Pages 배포와 version bump를
담당합니다.

- `README.md`: 제품 소개와 빠른 시작.
- `docs/ARCHITECTURE.md`: 런타임 경계와 데이터 흐름.
- `docs/CONTRIBUTING.md`: 작업·검증·PR 규칙.
- `AGENTS.md`: 코딩 에이전트 진입점.

architecture, permission, workflow 또는 onboarding이 바뀌면 관련 문서만 같은 PR에서
갱신합니다.
