# LinKU 관측성

LinKU의 Sentry 연동은 Chrome Extension의 세 런타임을 같은 프로젝트로 묶습니다.

- popup: React Error Boundary와 전역 브라우저 오류
- API client: 네트워크·응답 파싱·5xx와 토큰 정리 실패
- background: OAuth, silent reauth, 시간표 import, pending tab 처리 실패
- content: Everytime 시간표 DOM/API 처리의 예상하지 못한 Promise 실패

## 런타임 정책

`src/monitoring/sentry.ts`가 모든 번들의 공통 진입점입니다. DSN이 없는 개발 빌드는
Sentry를 초기화하지 않으므로 로컬 기본 빌드가 외부로 이벤트를 보내지 않습니다.

- `sendDefaultPii: false`
- user, request header/cookie/body 삭제
- URL의 민감한 query value와 breadcrumb/extra의 token·email 계열 값 비식별화
- tracing과 session replay를 기본 활성화하지 않음
- 기존 GA4 `sendError`와 React fallback UI는 유지

content script는 Chrome의 standalone classic-script 계약을 지키기 위해 별도 단일-entry
IIFE로 빌드합니다. `pnpm run build:local`과 release workflow는 일반 확장 번들과 content
번들을 각각 빌드합니다.

## GitHub Actions 설정

Sentry `linku` 프로젝트의 Client Key DSN은 클라이언트 번들에 들어가는 값이므로 GitHub
Actions repository variable로 관리합니다. 조직 토큰은 절대 `VITE_` 변수로 만들지
않습니다.

| 종류 | 이름 | 용도 |
| --- | --- | --- |
| Secret | `SENTRY_AUTH_TOKEN` | production release와 source map 업로드 |
| Variable | `SENTRY_ORG` | `turtlehwan` |
| Variable | `SENTRY_PROJECT` | `linku` |
| Variable | `VITE_SENTRY_DSN` | `linku` Client Key DSN |

토큰은 Sentry의 조직 토큰 생성 화면에서 source map/release 업로드에 필요한 최소
권한으로 발급합니다. 실제 token, DSN, API secret은 저장소 파일에 기록하지 않습니다.

release workflow는 manifest version을 올린 뒤 다음 형식의 release를 사용합니다.

```text
linku@<manifest-version>
```

production build는 hidden source map을 Sentry에 업로드한 뒤 `dist/**/*.map`을 삭제하고,
source map이 남아 있으면 `dist.zip`을 만들기 전에 실패합니다.

## 수집 확인 절차

기본 빌드에는 synthetic event가 없습니다. 실제 DSN을 로컬 shell 환경에만 주입하고,
일회성 smoke build에서만 다음 변수를 `true`로 설정할 수 있습니다.

```bash
VITE_SENTRY_DSN="<linku-client-dsn>" \
VITE_SENTRY_ENVIRONMENT=development \
VITE_SENTRY_RELEASE=linku@local-smoke \
VITE_SENTRY_SMOKE_TEST=true \
pnpm run build:local
```

생성된 `dist/`를 unpacked extension으로 로드한 뒤 popup을 열고 background/content
runtime을 한 번 발생시키고, Sentry `linku` 프로젝트에서 runtime tag가
`popup`, `background`, `content`로 들어오는지 확인합니다. 확인 후 smoke 변수는 즉시
제거하고, 실제 production release에서는 `VITE_SENTRY_SMOKE_TEST`를 설정하지 않습니다.

수집이 확인되었다고 판단하려면 다음을 모두 확인해야 합니다.

1. Sentry project의 Errors에 이벤트가 보임
2. 각 이벤트의 release가 `linku@<version>`으로 연결됨
3. stack trace가 원본 TypeScript/TSX 위치로 symbolicate됨
4. event에 access/refresh token, cookie, authorization header, email이 없음
5. Chrome Web Store용 zip에 `.map` 파일이 없음

Sentry 프로젝트에 이벤트가 보이지 않는 현재 상태는 SDK 코드만으로는 해결되지 않습니다.
DSN과 release-upload credential을 설정한 뒤 위 수집 확인을 한 번 수행해야 실제 운영
수집을 증명할 수 있습니다.
