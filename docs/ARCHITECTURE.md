# 아키텍처

LinKU는 Vite, React, TypeScript로 만든 Manifest V3 Chrome Extension입니다.

## 런타임

- Popup/extension page: `index.html` → `src/main.tsx` → `src/routes.tsx`
- Background service worker: `src/background/index.ts`
- Everytime content script: `src/content/everytime-timetable.ts`
- Static site: `web/index.html`

popup은 화면과 사용자 입력을 담당합니다. OAuth, badge, 시간표 import처럼 Chrome
extension API가 필요한 작업은 background가 담당합니다. content script는
`https://everytime.kr/timetable*`의 시간표 읽기에만 사용합니다.

## 소스 경계

- `src/pages/`, `src/layouts/`: route와 layout
- `src/components/`: feature UI와 공통 UI primitive
- `src/contexts/`, `src/hooks/`: 화면 상태와 side effect 연결
- `src/storage/indexedDb/`: IndexedDB schema와 version upgrade
- `src/storage/templates/`: 템플릿·아이콘·백업 repository
- `src/storage/account/`: 동기화 outbox, 계정 binding과 sync metadata
- `src/sync/`: 로컬 모델과 클라우드 문서 codec
- `src/apis/supabase/`: Auth, Postgres RPC/RLS와 Storage adapter
- `src/apis/external/`: 학교·외부 서비스의 공개 연동
- `src/background/`: MV3 message handler와 OAuth orchestration
- `src/types/`, `src/utils/`: 공유 contract와 cross-cutting utility

UI는 IndexedDB나 SQL을 직접 다루지 않습니다. 로컬 작업은 storage repository,
원격 작업은 Supabase adapter, 두 계층의 순서와 충돌 처리는 sync service가 담당합니다.

## 템플릿과 계정 동기화

```text
Editor save
  → IndexedDB templates + outbox (same transaction)
  → success UI
  → optional background sync
  → Supabase RPC with expected revision
```

템플릿과 사용자 아이콘은 항상 이 기기에 먼저 저장됩니다. 첫 Google 로그인 때 현재
로컬 항목을 outbox에 넣고 이후 여러 기기와 동기화합니다. 네트워크 실패는 outbox에
남으며 로컬 성공을 되돌리지 않습니다.

템플릿에는 로컬 UI용 숫자 `templateId`와 동기화용 UUID `id`가 있습니다. 숫자 ID는
IndexedDB transaction에서 발급하고, UUID는 계정 간 데이터 키로 사용합니다. 계정이
섞이지 않도록 한 Chrome profile의 로컬 저장소는 최초 연결한 Supabase user ID에
고정됩니다.

Postgres의 `revision`으로 optimistic concurrency를 검사합니다. 같은 템플릿을 두
기기에서 수정하면 원격본을 원래 항목에 적용하고 아직 동기화되지 않은 로컬본은
독립적인 `(충돌 복사본)`으로 보존합니다. 비정상 JSON, 원본 bytes나 사용자 ID는
Sentry로 보내지 않습니다.

## 게시와 커뮤니티

게시물은 원본 템플릿과 분리된 수동 snapshot입니다.

- 원본을 편집해도 게시물은 자동 변경되지 않습니다.
- 변경된 원본은 `업데이트 필요`로 표시하며 사용자가 게시물 업데이트를 선택합니다.
- 업데이트는 같은 publication ID, 좋아요와 복제 수를 유지합니다.
- 게시 중인 원본은 게시를 내리기 전 삭제할 수 없습니다.
- 복제본은 새 로컬 숫자 ID와 UUID를 가진 독립 템플릿입니다.

갤러리 조회·검색·복제는 익명으로 사용할 수 있고 게시·좋아요·닉네임 변경은 Google
로그인이 필요합니다. 검색과 정렬은 `browse_publications` RPC가 안전한 공개 필드만
반환합니다. Google email, 이름, 사진과 내부 owner ID는 공개 응답에 포함하지 않습니다.

## Supabase 보안 경계

- Chrome에는 Supabase URL과 publishable key만 포함합니다.
- Google client ID/secret, service-role key는 extension과 저장소에 넣지 않습니다.
- OAuth는 background의 `chrome.identity.launchWebAuthFlow`와 PKCE를 사용합니다.
- session은 `chrome.storage.local`의 trusted extension context에만 저장합니다.
- 사용자별 row와 object path는 RLS/Storage policy로 격리합니다.
- account RPC와 policy는 signed JWT의 Google provider를 다시 검사합니다.
- template document와 WebP asset은 client와 database 양쪽에서 크기·형식을 제한합니다.

`supabase/migrations/`가 schema의 단일 진실 원천이고 `src/types/supabase.ts`는 그
schema의 TypeScript contract입니다. Edge Function, Worker, Realtime과 cron은 사용하지
않습니다.

## 기타 데이터 흐름

Everytime 시간표는 로그인된 탭에서 사용자가 명시적으로 요청할 때만 읽습니다. 원본
snapshot, 사용자 override와 업로드 이미지는 분리해 저장하며 password, cookie,
session token은 읽거나 저장하지 않습니다.

공개 공지는 학교 RSS/HTML source를 직접 읽어 `chrome.storage.local`에 source별로
캐시합니다. 갱신 실패 시 마지막 cache를 유지하고 background polling이나 개인 학과
구독은 사용하지 않습니다.

배너는 background CacheStorage의 마지막 정상 JSON·이미지 snapshot을 먼저 반환하고,
새 snapshot이 완전히 준비된 경우에만 교체합니다.

## 저장소 지도

- IndexedDB `linku`: template, legacy draft, user icon blob, outbox, sync metadata,
  settings, quarantine
- `chrome.storage.local`: Supabase session, UI 설정, Todo, 시간표 metadata,
  공지 cache
- CacheStorage: 검증된 배너 snapshot
- Supabase Postgres: profile, template document, publication, like
- Supabase Storage: private user icon과 게시용 public icon

전체 로컬 템플릿과 참조 아이콘은 `linku-backup-*.json`으로 내보내고 복원할 수
있습니다. 단일 템플릿 URL/file 직접 공유는 제공하지 않습니다.

## 빌드와 배포

`pnpm run build:local`은 version을 바꾸지 않고 extension과 content script를
빌드합니다. `main` workflow만 manifest version, Chrome Web Store draft, GitHub
Release와 정적 Pages 배포를 관리합니다. 일반 PR에서 manifest version을 직접
수정하지 않습니다.
