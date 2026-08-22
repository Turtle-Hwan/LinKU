# LinKU 관측성

LinKU의 Sentry 연동은 Chrome Extension의 세 런타임을 같은 프로젝트로 묶습니다.

- popup: React Error Boundary와 전역 브라우저 오류
- background: 전역 오류·unhandled rejection, OAuth, silent reauth, 시간표 import, pending tab, badge, service worker lifecycle
- content: 전역 오류·unhandled rejection, Everytime 입력 검증·DOM/API 처리·message 응답 실패
- API/Chrome bridge: 모든 non-2xx 응답, 네트워크·응답 파싱·토큰 정리, storage/tab/script injection 실패
- handled application errors: 공통 `errorLog`와 주요 UI fallback 경로

GitHub Pages의 share viewer는 이 범위에서 의도적으로 제외합니다. 해당 페이지는
`connect-src 'none'` CSP로 template fragment가 어떤 원격 collector에도 전송되지
않게 하며, 잘못된 공유 링크는 페이지 안의 사용자 안내로만 처리합니다. 정적 link
catalog와 grid renderer도 monitoring 의존성이 없는 leaf module만 사용하고,
`pnpm run build:gh-pages`가 Rollup module graph를 검사해 `src/monitoring`이나
Sentry SDK가 Pages 산출물에 섞이면 PR과 실제 배포 빌드를 모두 실패시킵니다.

## 모듈 경계

애플리케이션 코드는 `src/monitoring/index.ts`의 provider-neutral API만 사용합니다.
Sentry SDK를 직접 import하는 파일은 collector adapter인 `src/monitoring/sentry.ts` 하나로
제한합니다.

- `reporter.ts`: feature/category/mechanism 문맥, 오류 breadcrumb, short-lived MV3 runtime용
  flush, 전역 `error`/`unhandledrejection` 정책과 no-throw 수집 경계
- `normalizeError.ts`: `Error`가 아닌 rejection 값을 안전한 `Error`와 원본 문맥으로 정규화
- `runtimeMessage.ts`: background/content 공통 message type 판별, one-shot 응답,
  중복 응답과 닫힌 channel 수집
- `redaction.ts`: console logger와 Sentry collector가 함께 쓰는 token·credential·개인정보
  제거 규칙
- `scrubber.ts`: 깊이·너비 제한, 순환 참조 처리, 최종 event/breadcrumb 개인정보 제거
- `constants.ts`: SDK와 공통 reporter가 함께 쓰는 수집량·정규화·flush 정책
- `sentry.ts`: SDK 초기화, scope 연결, scrubber hook, transport flush
- `src/errors/userFacingError.ts`: 내부 상세 오류와 사용자에게 노출해도 되는 문구의 경계

API, Chrome bridge, background, content처럼 기본 category와 mechanism이 반복되는 영역은
`createErrorReporter`로 영역별 reporter를 만들고, 실제 오류 지점에서는 feature와 안전한
추가 문맥만 전달합니다. 그래서 breadcrumb → capture → flush 순서와 handled 기본값이
호출부마다 달라지지 않습니다.

예상 가능한 도메인 실패만 `UserFacingError`로 표시합니다. runtime 경계에서는 이 타입의
문구만 사용자 응답에 사용하고, 그 밖의 예외는 기능별 고정 fallback을 반환합니다. 원본
오류는 `reportError`로 계속 수집하므로 디버깅 정보와 사용자 안전 문구가 서로 섞이지
않습니다.

## 런타임 정책

DSN이 없는 개발 빌드는 collector를 초기화하지 않으므로 로컬 기본 빌드가 외부로 이벤트를
보내지 않습니다.

- `sendDefaultPii: false`
- SDK 기본 global handler는 끄고 popup/background/content에 동일한 전역 `error`와
  `unhandledrejection` handler를 설치
- 최대 200개 breadcrumb, stacktrace 자동 첨부, 중첩 객체 normalization depth 6
- user, request header/cookie/body/raw query string 삭제
- URL의 민감한 query value와 exception/message/breadcrumb/extra를 포함한 모든 중첩 문맥의
  token·email·credential 값 비식별화
- tracing과 session replay를 기본 활성화하지 않음
- `MONITORING_IGNORED_ERROR_MESSAGES`의 생명주기 잡음은 수집하지 않음. 브라우저 종료
  시점의 `The browser is shutting down.`은 LinKU의 실패가 아니라 MV3 service worker가
  내려가는 정황이므로 console 경고만 남기고 collector는 버림
- 기존 GA4 `sendError`와 React fallback UI는 유지

처리된 오류도 누락하지 않도록 `errorLog`는 console 출력과 함께 handled Sentry exception을
기록하고, `warnLog`도 같은 경로로 `warning` level exception을 기록합니다. 경고는 실패했지만
흡수된 경로를 뜻하므로, 사용자에게 toast나 축소된 결과가 보이는데 수집에는 아무 흔적이 남지
않던 구간이 바로 여기였습니다. `debugLog`와 `infoLog`는 계속 console 전용입니다.

하위 저장소 함수가 오류를 다시 throw할 때는 그 자리에서 중복 수집하지 않습니다. toast나
fallback으로 실패를 최종 처리하는 UI·runtime 경계가 원본 오류를 한 번 기록하고, 내부에서
실패를 흡수해 계속 진행하는 repair·migration 경로만 저장소 안에서 직접 기록합니다.

실패를 예외가 아니라 `{ success: false, code }`로 돌려주는 경로도 수집합니다. 시간표 import는
결과 코드를 tag로 붙여 warning으로 기록하므로, LOGIN_REQUIRED·TAB_UNAVAILABLE·
TIMETABLE_NOT_FOUND·NO_PREVIOUS_SEMESTERS의 분포를 실제 데이터로 볼 수 있습니다. 응답 원문·request body·토큰·쿠키는 수집하지 않고, API 오류는 endpoint path,
HTTP method/status, error code, response shape와 직전 breadcrumbs로 재현에 필요한 맥락을
남깁니다. background/content의 `runtime.sendResponse`는 one-shot responder로 감싸 중복
응답과 채널 종료 오류도 별도 기록합니다.

content script는 Chrome의 standalone classic-script 계약을 지키기 위해 별도 단일-entry
IIFE로 빌드합니다. `pnpm run build:local`과 release workflow는 일반 확장 번들과 content
번들을 각각 빌드합니다.

## GitHub Actions 설정

Sentry Project Settings의 Inbound Filters에서는 `browser extensions`, `hydration errors`,
`ChunkLoadError` 필터를 끕니다. LinKU 자체가 Chrome Extension이므로 첫 번째 필터를 켜면
정상적인 LinKU 오류까지 제3자 확장 프로그램 노이즈로 오인해 버릴 수 있습니다. 서버 측
Data Scrubber와 Default Scrubbers는 켠 상태를 유지합니다.

Sentry `linku` 프로젝트의 Client Key DSN은 클라이언트 번들에 들어가는 값이므로 GitHub
Actions repository variable로 관리합니다. 조직 토큰은 절대 `VITE_` 변수로 만들지
않습니다.

source map 업로드가 실패하면 release build를 실패시킵니다. `@sentry/vite-plugin`은 업로드
오류 뒤에도 정상 종료하고 `silent`가 원인을 감추므로, 이 설정이 없으면 권한이 부족한 토큰
하나로 source map 없는 release가 그대로 배포되면서 workflow는 초록색으로 남습니다.
`filesToDeleteAfterUpload`는 업로드 성공 여부와 무관하게 `.map`을 지우기 때문에, "Verify
source maps are not packaged" 단계는 업로드 실패를 잡아내지 못합니다.

| 종류 | 이름 | 용도 |
| --- | --- | --- |
| Secret | `SENTRY_AUTH_TOKEN` | production release와 source map 업로드 (`org:ci`, `org:read`) |
| Variable | `SENTRY_ORG` | `turtlehwan` |
| Variable | `SENTRY_PROJECT` | `linku` |
| Variable | `VITE_SENTRY_DSN` | `linku` Client Key DSN |

토큰은 개인 계정과 분리된 Sentry Internal Integration의 조직 토큰으로 만들고 `org:ci`와
`org:read`만 부여합니다. 실제 token, DSN, API secret은 저장소 파일에 기록하지 않습니다.

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
runtime을 각각 한 번 발생시키고, Sentry `linku` 프로젝트에서 runtime tag가
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
