# 아키텍처

이 문서는 LinKU의 런타임 경계와 데이터 흐름만 설명합니다. 실행·기여 규칙은
`docs/CONTRIBUTING.md`, 에이전트 진입점은 `AGENTS.md`를 따릅니다.

## 런타임

LinKU는 Vite, React, TypeScript로 만든 Manifest V3 Chrome Extension이며 세
영역으로 실행됩니다.

- Popup UI: `index.html` → `src/main.tsx` → `src/routes.tsx`.
- Background service worker: `src/background/index.ts`.
- Everytime content script: `src/content/everytime-timetable.ts`.

popup은 화면과 사용자 입력을 담당하고, OAuth·badge·시간표 import처럼 extension
API가 필요한 작업은 background worker가 담당합니다. content script는
`https://everytime.kr/timetable*`에서만 실행됩니다.

extension build는 다음 entry를 `dist/`에 생성합니다.

- `index.html`
- `background/index.js`
- `content/everytime-timetable.js`

로컬 검증에는 version을 올리지 않는 `pnpm run build:local`을 사용합니다.

## 소스 경계

- `src/pages/`, `src/layouts/`: route와 layout.
- `src/components/Tabs/`: popup feature.
- `src/components/ui/`: 공통 UI primitive.
- `src/components/Editor/`: template editor.
- `src/contexts/`, `src/hooks/`: React state와 reusable hook.
- `src/storage/`: IndexedDB schema, record normalization과 repository primitive.
- `src/apis/`: 현재 연결된 LinKU backend client. 템플릿·아이콘 로컬 저장은 포함하지 않음.
- `src/apis/external/`: 학교·외부 서비스 연동.
- `src/background/`: MV3 service worker와 message handler.
- `src/content/`: 허용된 외부 페이지 content script.
- `src/types/`, `src/utils/`: 공유 contract와 cross-cutting utility.

## 주요 데이터 흐름

### 개인 템플릿과 공유

개인 템플릿 CRUD는 LinKU backend와 분리되어 있습니다. popup과 editor는
`src/utils/templateStorage.ts`의 저장소 경계만 사용하고, 실제 템플릿은 `linku`
IndexedDB에 저장합니다. `src/storage/legacyTemplateStorage.ts`가 이전 저장소 이관을,
`src/storage/templateIconRepair.ts`가 읽기 시 아이콘 복구를 각각 맡습니다. 사용자가
올린 아이콘도 256px 이하 WebP로 정규화한 뒤 같은 DB의 별도 store에 저장하며 화면은
`src/utils/localIcons.ts`의 명시적인 로컬 작업만 호출합니다. `drafts` store는 이전
버전의 draft를 잃지 않도록 보관하지만 현재 편집 흐름에는 연결하지 않습니다.

기존 `localStorage` 템플릿과 draft는 popup이 처음 저장소를 열 때 한 번
IndexedDB로 복사합니다. 이전 값은 한 릴리즈 동안 rollback 원본으로 남기므로
마이그레이션 실패가 기존 데이터 삭제로 이어지지 않습니다.

작은 템플릿 공유 링크는 압축한 payload를 GitHub Pages URL의 fragment(`#`)에
담습니다. fragment는 HTTP 요청에 포함되지 않으며 Pages의 `/share/` 화면에서만
검증·해제됩니다. URL 제한을 넘는 템플릿은 서버에 자동 업로드하지 않고
`.linku.json` 파일로 내보냅니다. Pages에서 확장 프로그램으로 가져오는 외부
메시지는 manifest와 background 양쪽에서 LinKU share 경로로 제한합니다.

계정 로그인, 여러 기기 동기화, 충돌 처리와 cloud share는 이 로컬 저장소 위에
별도 계층으로 추가하며, 로컬 저장 성공 여부와 분리해야 합니다. 상세 경계는
`docs/LOCAL_FIRST.md`를 참고합니다.

### Backend와 인증

`src/apis/client.ts`가 `VITE_API_BASE_URL`을 기준으로 backend 요청, bearer token,
response parsing, 만료 감지를 중앙 처리합니다. Google OAuth는
`src/background/handlers/oauth.ts`에서 `chrome.identity.launchWebAuthFlow`를
사용하며 token은 `chrome.storage.local`에 저장합니다.

feature API는 이 client와 background 경계를 재사용해야 합니다. auth code,
token, authorization header를 로그에 남기지 않습니다.

### Everytime 시간표

```text
Popup
  → Background import handler
  → 로그인된 Everytime 탭 재사용 또는 임시 탭 생성
  → Content script의 학기·시간표 XML API
  → API 실패 시 렌더링된 DOM fallback
  → 구조화 snapshot 저장
```

가져오기는 사용자가 요청할 때만 실행됩니다. 현재 학사 시기의 네 학기부터
탐색하고, 묶음 전체가 비어 있으면 이전 묶음으로 이동합니다. 수동 동기화는 새
학기를 추가하고 같은 학기의 snapshot만 갱신하며, 다른 학기·업로드 이미지·active
선택은 유지합니다.

원본 snapshot과 사용자 override는 별도 저장하고 조회 시 병합합니다. 현재
popup에는 override 편집 UI가 없지만 저장 경계는 원본을 덮지 않도록 분리되어
있습니다. LinKU는 Everytime password, cookie, session token을 읽거나 저장하지
않습니다.

### 공개 공지

공개 공지는 학교 RSS와 HTML source별로 `chrome.storage.local`에 캐시합니다.
화면 진입 시 필요한 source만 갱신하고, 실패하면 기존 캐시를 유지합니다.
popup이 닫힌 동안 background polling은 실행하지 않습니다.

### 배너

popup의 기존 배너 요청은 background service worker가 가로채 CacheStorage의 마지막
정상 JSON·이미지 snapshot을 먼저 반환합니다. 하루에 한 번 새 JSON과 참조 이미지가
모두 준비된 경우에만 snapshot을 교체하며, 실패하면 기존 snapshot을 유지합니다.
배너 운영 기간은 캐시 시점이 아니라 popup을 열 때의 현재 시각으로 판정합니다.

## Storage

- `chrome.storage.local`: auth, 설정, todo, badge, 공지 캐시, 배너 재검사 시각,
  시간표 metadata와 snapshot/override.
- CacheStorage: 마지막으로 검증된 배너 JSON·이미지 snapshot.
- IndexedDB `linku`: 개인 template, legacy draft, 사용자 icon blob, 손상 record 격리.
- `localStorage`: non-extension 시간표 fallback과 이전 template/draft의 1회
  마이그레이션 원본. 새 template 데이터는 쓰지 않습니다.
- IndexedDB: 사용자가 직접 올린 시간표 이미지 blob.

시간표 metadata의 read-modify-write는 Web Locks로 popup과 background 사이에서
직렬화합니다. 저장 shape를 변경할 때는 기존 schema migration과 사용자 데이터
보존을 함께 구현해야 합니다.

## UI 구성

UI는 Tailwind CSS, shadcn-style Radix primitive, Lucide icon을 사용합니다.
공통 primitive를 우선 재사용합니다. 하나의 feature가 loading·empty·saved·dialog
같은 여러 역할로 구성되면 compound component로 조합하되, 단일 역할 component를
불필요하게 감싸지 않습니다.

## 권한과 배포

Chrome permission과 `host_permissions`는 `public/manifest.json`에서 관리합니다.
새 권한은 필요한 domain과 API로 최소화하고, 변경 시 보안 경계와 실제 extension
검증 방법을 PR에 기록합니다.

PR은 `.github/workflows/pr-build-check.yml`에서 build를 검증합니다. main의 release
workflow가 manifest version, Chrome Web Store draft, GitHub Release와 Pages 배포를
관리하므로 일반 PR에서 `public/manifest.json` version을 직접 수정하지 않습니다.

Sentry 관측성은 `docs/OBSERVABILITY.md`에 정리합니다. popup, background service
worker, Everytime content script는 공통 초기화 정책을 사용하며, content script는
standalone classic script로 별도 빌드합니다. production release는 `linku@<manifest-
version>` release에 source map을 업로드한 뒤 확장 프로그램 zip에서 source map을
제거합니다.
