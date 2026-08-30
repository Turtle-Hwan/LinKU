# Local-first 계정 동기화 계약

LinKU의 로컬 저장이 제품의 기본 경로이고 Supabase 계정 동기화는 선택적인 두 번째
계층입니다.

## 장애 시 보장

| 기능 | 로컬 저장 | Supabase 장애 시 |
| --- | --- | --- |
| 템플릿 생성·조회·수정·적용 | IndexedDB `templates` | 정상 동작 |
| 사용자 아이콘 | IndexedDB `assets` | 업로드·편집 가능 |
| 전체 백업·복원 | JSON file | 정상 동작 |
| 손상 레코드 보존 | IndexedDB `quarantine` | 원본 내보내기 가능 |
| 여러 기기 동기화 | outbox → Supabase | 로컬 변경을 대기열에 보존 |
| 갤러리 | Supabase RPC/Storage | 기본 제공 템플릿 fallback |
| 게시·좋아요·닉네임 | Supabase | 재시도 안내, 로컬 데이터 무영향 |

## IndexedDB schema

현재 DB 이름은 `linku`, version은 5입니다. 배포된 local-only version 4에서 다음
store만 additive하게 추가합니다.

- `outbox`: template/asset별 마지막 put/delete 작업
- `syncMeta`: remote revision, content hash, 게시 snapshot 상태
- `settings`: 최초 연결한 account ID

기존 `templates`, `drafts`, `assets`, `migrations`, `quarantine`는 다시 쓰거나
삭제하지 않습니다. 이전 localStorage template은 fingerprint 기반 migration으로
한 번 가져오며 읽을 수 없는 값은 삭제 대신 격리합니다.

템플릿 저장과 outbox 갱신, 아이콘 저장과 outbox 갱신은 각각 같은 IndexedDB
transaction입니다. 따라서 로컬 성공 뒤 동기화 항목이 사라지는 중간 상태가 없습니다.

## 동기화 규칙

1. 아이콘을 먼저 올립니다.
2. 템플릿은 마지막으로 본 remote revision을 함께 전송합니다.
3. revision이 맞으면 remote revision을 증가시키고 outbox를 지웁니다.
4. 충돌하면 로컬 변경을 새 UUID의 복사본으로 보존하고 remote 최신본을 적용합니다.
5. remote tombstone은 다른 기기의 로컬 항목을 삭제합니다.

무료 Postgres에 삭제 이력이 끝없이 쌓이지 않도록 계정별 최신 tombstone 100개를
유지합니다. 그보다 오래 오프라인이었던 기기에서 이미 정리된 항목이 다시 발견되면
원격본을 덮지 않고 새 UUID의 충돌 복사본으로 복구합니다.

자동 동기화는 로그인 직후, 온라인 복귀와 로컬 템플릿 변경 때 실행합니다. 같은
runtime의 중복 실행은 하나의 promise로 직렬화합니다. 수동 `지금 동기화`도 같은
service를 사용합니다.

로그아웃은 session만 지우며 로컬 데이터와 outbox를 유지합니다. 한 Chrome profile에
서로 다른 계정 데이터를 합치지 않도록 account binding도 유지합니다. `LinKU 클라우드
데이터 삭제`는 remote template, icon, publication과 like를 삭제하지만 로컬 IndexedDB와
Supabase Auth user 자체는 삭제하지 않습니다.

## 게시 snapshot

게시물에는 공개에 필요한 `name`, `height`, `items`만 복사합니다. staging item,
Google profile과 내부 account ID는 포함하지 않습니다. 원본의 공개 내용 hash가 마지막
게시 hash와 다르면 업데이트 필요 상태가 됩니다. 업데이트 전까지 기존 snapshot을
계속 보여 주므로 작성 중 변경이 공개 화면에 섞이지 않습니다.

## 제한과 복구

- 계정당 active template 100개, user icon 100개, active publication 25개
- template JSON 256 KiB 이하
- icon 하나당 512 KiB 이하의 WebP
- publication 목록은 한 요청에 최대 24개

로컬 저장 공간 부족은 동기화 실패와 별도로 안내합니다. 명시적인 전체 JSON 백업은
계정 동기화 여부와 무관한 복구 경로로 유지합니다. 기존 Spring backend의 데이터는
자동 이관하지 않으며 KU email 인증, 학과 구독, 공지 crawler와 단일 템플릿 직접
공유는 폐기합니다.
