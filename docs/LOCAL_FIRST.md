# Local-first 계정 동기화 계약

LinKU의 로컬 저장이 제품의 기본 경로이고 Supabase 계정 동기화는 선택적인 두 번째
계층입니다.

## 장애 시 보장

| 기능 | 로컬 저장 | Supabase 장애 시 |
| --- | --- | --- |
| 템플릿 생성·조회·수정·적용 | IndexedDB `templates` | 정상 동작 |
| 미게시 템플릿 삭제 | IndexedDB `templates` + outbox | 로컬 삭제 후 원격 작업 대기 |
| 사용자 아이콘 CRUD | IndexedDB `assets` + outbox | 생성·조회·이름 변경·미사용 삭제 가능, 원격 작업 대기 |
| 편집 draft | IndexedDB `drafts` | 이전 draft 보관만 지원, 자동 저장 UI 미연결 |
| 적용 중인 템플릿 ID | `chrome.storage.local` | popup 재실행 후 유지 |
| 전체 백업·복원 | JSON file | 정상 동작 |
| 손상 레코드 보존 | IndexedDB `quarantine` | 원본 내보내기 가능 |
| 여러 기기 동기화 | outbox → Supabase | 로컬 변경을 대기열에 보존 |
| 갤러리 | Supabase RPC/Storage | 기본 제공 템플릿 fallback |
| 게시·좋아요·닉네임 | Supabase | 재시도 안내, 로컬 데이터 무영향 |

## IndexedDB schema

현재 DB 이름은 `linku`, version은 5입니다. 배포된 local-only version 4에서 다음
store만 additive하게 추가합니다.

- `outbox`: template·asset의 마지막 put/delete 작업
- `syncMeta`: remote revision, content hash, 게시 snapshot 상태, 원격 아이콘 삭제 여부
- `settings`: 최초 연결한 account ID

기존 `templates`, `drafts`, `assets`, `migrations`, `quarantine`는 다시 쓰거나
삭제하지 않습니다. 이전 localStorage template은 fingerprint 기반 migration으로
한 번 가져오며 읽을 수 없는 값은 삭제 대신 격리합니다.

`idb` 라이브러리의 upgrade에서 store·index 존재 여부를 확인하고, 이전 연결이 upgrade를
막으면 `blocking` callback에서 연결을 닫습니다. `drafts`는 레거시 보관 슬롯이며
에디터 자동 저장에 연결되어 있지 않습니다. 화면의 `templateId === 0`은 기본 템플릿 또는
저장 전 템플릿을 뜻하므로 draft 식별자로 사용하지 않습니다.

템플릿 저장과 outbox 갱신, 아이콘 저장과 outbox 갱신은 각각 같은 IndexedDB
transaction입니다. 따라서 로컬 성공 뒤 동기화 항목이 사라지는 중간 상태가 없습니다.

## 로컬 데이터 무결성과 백업

- 숫자 ID는 저장과 같은 transaction에서 사용 중인 최대값보다 크게 발급합니다.
- 읽을 때 `normalizeStoredTemplate`으로 좌표·항목 ID·시각을 보정합니다. 복구 불가능한
  값은 `quarantine`에 원본을 보존하고, 사용자에게 복구 파일 내보내기를 제공합니다.
- 이전 localStorage 이관은 원본별 fingerprint와 처리 결과를 데이터와 같은 transaction에
  기록합니다. 실패하면 현재 작업도 실패로 알립니다. 원본은 남기되 사용자가 템플릿을
  삭제하면 해당 legacy 원본도 제거하여 다음 실행에 되살아나지 않게 합니다.
- 인라인 아이콘의 숫자 ID가 없거나 다른 이미지를 가리키면 실제 이미지로 재등록하여
  편집을 복구합니다. 단, 다른 기기에서 삭제된 아이콘은 자동 재등록하지 않습니다.
  사용자 아이콘은 최대 256px WebP로 정규화합니다.
- 백업은 모든 로컬 템플릿과 **그 템플릿이 참조하는 아이콘**을 담습니다. 미사용 아이콘,
  시간표, 인증 세션은 포함하지 않으며 격리 원본은 별도 복구 파일로 내보냅니다.
- 백업 내보내기와 복원 모두 10 MiB 제한을 적용합니다. 파일 envelope·아이콘을 검증한 뒤
  복원하며 템플릿의 숫자 ID와 UUID를 새로 발급해 기존 항목을 덮지 않습니다. 아이콘 참조는
  복원된 asset으로 연결하고, 검증된 WebP bytes는 재인코딩하지 않아 같은 hash를 재사용합니다.
- 저장 공간 부족과 그 밖의 오류는 구분해 알립니다. `unlimitedStorage` 권한은 사용하지
  않으며, 확장 제거·로컬 데이터 손실이나 아직 동기화되지 않은 변경의 복구에는 백업이 필요합니다.

## 동기화 규칙

1. 아이콘 생성·이름 변경을 먼저 동기화합니다. 이름 변경은 이미지 재업로드 없이 metadata만 전송합니다.
2. 템플릿은 마지막으로 본 remote revision을 함께 전송합니다.
3. revision이 맞으면 remote revision을 증가시키고 outbox를 지웁니다.
4. 충돌하면 로컬 변경을 새 UUID의 복사본으로 보존하고 remote 최신본을 적용합니다.
5. 템플릿 변경 뒤 아이콘 삭제를 처리합니다. 템플릿 tombstone은 다른 기기의 로컬 항목을 삭제합니다.

무료 Postgres에 템플릿 삭제 이력이 끝없이 쌓이지 않도록 계정별 최신 tombstone 100개를
유지합니다. 그보다 오래 오프라인이었던 기기에서 이미 정리된 항목이 다시 발견되면
원격본을 덮지 않고 새 UUID의 충돌 복사본으로 복구합니다.

개인 아이콘은 별도 서버 tombstone 없이 전체 목록과 마지막 동기화 기록을 비교합니다.
생성·이름 변경마다 DB sequence로 새 revision을 발급하므로, 삭제 후 같은 이미지를 다시
올려도 오래된 기기의 rename/delete가 적용되지 않습니다. 이름 충돌은 서버 최신 이름을
반영하며 이미지 복사본은 만들지 않습니다.

편집기의 `내 아이콘 관리`는 저장 전 canvas·staging에서 사용 중인 아이콘의 삭제를 막습니다.
repository는 저장된 template·legacy draft 참조를 같은 transaction에서 다시 검사합니다.
서버도 계정 잠금 안에서 소유권·revision·활성 template의 canvas/staging 참조를 검사하며,
`put_template`은 미등록 아이콘 참조를 거부합니다. 다른 기기의 참조 때문에 삭제가 거절되면
로컬 아이콘을 복구하고 이유를 알립니다.

원격 삭제는 metadata 삭제 후 Storage API로 파일을 삭제합니다. 파일 정리가 실패하면
outbox를 유지해 재시도하며, 등록된 파일의 직접 삭제·덮어쓰기는 Storage policy가 거부합니다.
확인된 삭제는 로컬 blob도 정리합니다. 아직 로컬 템플릿에만 참조가 남아 있다면 원본 이미지와
삭제 표시를 보관하되 목록에서 숨기고 재업로드하지 않아, 사용자가 아이콘을 다시 선택할 수 있습니다.

자동 동기화는 로그인 직후, 온라인 복귀와 로컬 템플릿·아이콘 변경 때 실행합니다. 같은
runtime의 중복 실행은 하나의 promise로 합치고, 진행 중 추가된 요청은 다음 회차에서
처리합니다. popup·확장 페이지·background 간에는 Web Locks로 동기화와 계정 전환을
직렬화합니다. 모든 동기화는 현재 Google 세션과 로컬 account binding이 같은지 확인한
뒤 시작합니다. 수동 `지금 동기화`도 같은 service를 사용합니다.

원격 응답을 적용할 때에는 최신 outbox를 다시 확인하고 템플릿·충돌 복사본·revision을
하나의 IndexedDB transaction으로 반영합니다. 응답을 기다리는 동안 생긴 편집이나 삭제는
덮어쓰지 않습니다. Google 로그인 후 account binding은 popup이 닫혀도 background에서
완료합니다.

로그아웃은 session만 지우며 로컬 데이터와 outbox를 유지합니다. 한 Chrome profile에
서로 다른 계정 데이터를 합치지 않도록 account binding도 유지합니다. `LinKU 클라우드
데이터 삭제`는 remote template, icon, publication과 like를 삭제하지만 로컬 IndexedDB와
Supabase Auth user 자체는 삭제하지 않습니다.

공개 닉네임 후보는 TypeScript에서 `따뜻한 건구스`처럼 형용사와 `건구스`/`건덕이`를
조합합니다. 로그인 후 명시적으로 프로필 초기화를 요청하고, DB는 프로필이 없을 때만
저장해 여러 기기의 초기화가 기존 이름을 덮지 않도록 합니다. 조회는 데이터를 변경하지
않습니다. 중복 가능한 표시 이름이며 Google 이름·이메일을 사용하지 않습니다.
설정에서 직접 변경할 수 있고, 클라우드 데이터 삭제로 프로필이 제거되면 다음 로그인에서
새 이름을 생성합니다.

## 게시 snapshot

게시물에는 공개에 필요한 `name`, `height`, `items`만 복사합니다. staging item,
Google profile과 내부 account ID는 포함하지 않습니다. 원본의 공개 내용 hash가 마지막
게시 hash와 다르면 업데이트 필요 상태가 됩니다. 업데이트 전까지 기존 snapshot을
계속 보여 주므로 작성 중 변경이 공개 화면에 섞이지 않습니다.

게시 RPC는 호출자가 확인한 공개 내용 hash와 현재 원본 hash가 같고 필요한 공개 아이콘이
모두 업로드됐을 때만 게시합니다. 다른 기기의 정리 작업은 현재 게시 snapshot이 참조하는
아이콘을 삭제할 수 없습니다.

게시물 복제는 로그인 없이 로컬에 저장할 수 있습니다. 공개 clone counter는 익명
쓰기 API를 열지 않도록 Google 로그인 상태에서만 best-effort로 집계하며, 집계 실패가
로컬 복제 결과를 되돌리지 않습니다.

## 제한과 복구

- 계정당 active template 100개, user icon 100개, active publication 25개
- 계정당 게시용 public icon object 900개
- template JSON 256 KiB 이하
- 6×6 grid, item 최대 36개, HTTP(S) 링크만 허용
- icon 하나당 512 KiB 이하의 WebP
- 가져오는 인라인 이미지는 PNG·JPEG·WebP만 허용하며 실행 가능한 SVG data URL은 거부
- publication 목록은 한 요청에 최대 24개

이 수치는 애플리케이션의 저장 상한이지 Supabase 무료 플랜의 전체 용량·요청량 보장이
아닙니다. 로컬 백업은 계정 동기화 여부와 무관한 복구 경로로 유지합니다.

## 기존 기능의 이관 범위

기존 Spring backend 데이터는 자동 이관하지 않습니다. KU email 인증·학과 구독·backend
공지 crawler·단일 템플릿 URL/file 직접 공유는 폐기하고, 공개 공지는 프론트 직접 조회를
유지합니다. 자체 JWT는 Supabase Google Auth로, 템플릿 API는 local-first 저장·동기화와
공개 snapshot 게시로 대체합니다.

| 기존 사용자 기능 | 현재 구현 |
| --- | --- |
| Google 로그인·세션 갱신 | Supabase Google Auth·PKCE, KU 인증 없이 사용 |
| 템플릿 생성·상세·수정·삭제 | IndexedDB repository + revision 기반 계정 동기화 |
| 내가 만든/가져온 템플릿 검색·최신/오래된순 | 로컬 목록 필터·정렬 |
| 사용자 아이콘 생성·목록·이름 변경·개별 삭제 | `내 아이콘 관리` + asset repository/outbox + 소유권·참조 검증 RPC |
| 기본 아이콘 목록 | 확장 번들 상수, 서버 요청 없음 |
| 게시·내 게시물·공개 검색/정렬·상세·게시 내리기 | 갤러리의 `내 게시물` 필터·snapshot 미리보기, 최신/오래된/좋아요/복제순 |
| 게시물 복제·좋아요/취소 | 로컬 복사본 + 로그인 시 counter/like 반영 |

템플릿 수정·삭제가 **개인 아이콘 전체를 자동 정리하는 것은 아닙니다.** 개인 아이콘 CRUD,
게시용 미사용 파일 정리, 전체 클라우드 데이터 삭제는 서로 다른 수명주기입니다. 게시물은
별도 공개 이미지 복사본을 사용하므로 개인 아이콘의 이름 변경이 게시 snapshot을 바꾸지 않습니다.
게시 내용 hash도 라이브러리 이름이 아니라 이미지 hash를 비교하므로 이름 변경만으로 게시물
업데이트를 요구하지 않습니다. backend의 직접 업로드 20 MiB 상한과 달리 확장 UI의 원본 5 MiB
제한을 유지하고, 같은 이미지 bytes는 하나의 개인 아이콘으로 중복 제거합니다.
과거 REST URL 자체의 호환성을 유지하는 방식은 아닙니다.
