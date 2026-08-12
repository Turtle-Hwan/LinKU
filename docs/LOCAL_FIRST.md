# Local-first 경계

LinKU의 개인화 기능은 서버가 없어도 먼저 동작하고, 계정 기능은 그 위에 선택적으로
붙이는 구조를 사용합니다. 이 문서는 stateless 기반과 후속 stateful 계층 사이의
계약을 설명합니다.

## Stateless 기반

현재 기반에서 서버 없이 완결되는 기능은 다음과 같습니다.

| 데이터/기능 | 저장 또는 전달 위치 | 서버 장애 시 동작 |
| --- | --- | --- |
| 개인 템플릿 | Chrome IndexedDB `linku/templates` | 생성·조회·수정·삭제 가능 |
| 편집 draft | Chrome IndexedDB `linku/drafts` | 편집 복구 가능 |
| 사용자 아이콘 | Chrome IndexedDB `linku/assets` | 업로드·이름 변경·삭제 가능 |
| 적용 중인 템플릿 ID | `chrome.storage.local` | popup 재실행 후 유지 |
| 작은 템플릿 공유 | GitHub Pages URL fragment | 서버 저장 없이 미리보기·가져오기 가능 |
| 큰 템플릿 공유 | `.linku.json` 파일 | 파일 전달로 내보내기·가져오기 가능 |

`templateStorage.ts`의 저장 함수 이름은 기존 호출부와 migration 의미를 드러내기
위해 유지하지만 모든 읽기와 쓰기는 비동기 IndexedDB 작업입니다. 과거
`localStorage` 값은
`local-storage-templates-v1` migration이 완료되기 전에 복사하며, migration 완료
기록과 데이터 저장을 같은 transaction에서 처리합니다. rollback을 위해 원본 값은
남겨 두되, 사용자가 IndexedDB에서 템플릿을 삭제하면 같은 legacy 항목도 함께
삭제하여 다음 migration에서 되살아나지 않게 합니다.

## 공유 보안 경계

- URL payload는 gzip 후 base64url로 인코딩하며 `#v1.` 뒤에 둡니다.
- payload는 template 1개, item 최대 36개, 6×6 grid, HTTP(S) 링크만 허용합니다.
- 압축 해제 결과와 파일은 256KB 이하만 처리합니다.
- 실행 가능한 SVG data URL은 받지 않고 PNG, JPEG, WebP base64만 허용합니다.
- 외부 URL 아이콘은 내보낼 때 기본 링크 아이콘으로 바꾸고, 가져올 때는 거부해
  미리보기만으로 제3자 서버에 요청하지 않게 합니다.
- Pages의 외부 extension message는
  `https://turtle-hwan.github.io/LinKU/share/`에서만 받습니다.
- Pages에서 보낸 가져오기 요청은 service worker가 `chrome.storage.local` queue에
  보관하고, popup이 열릴 때 검증 후 IndexedDB에 저장합니다.

## Stateful 계층의 계약

계정 동기화 계층은 다음 원칙을 지켜 이 기반 위에서 동작합니다.

1. IndexedDB 저장은 항상 먼저 완료하고 성공 UI를 반환합니다.
2. 동기화는 durable outbox로 별도 수행하며 네트워크 실패가 로컬 저장을 rollback하지
   않습니다.
3. DB schema를 확장할 때 version을 올리고 기존 `templates`, `drafts`, `assets`,
   `migrations` store를 그대로 보존합니다.
4. Google 로그인은 동기화와 여러 기기 사용을 위한 선택 기능입니다. 개인 템플릿
   편집 자체의 선행 조건이 아닙니다.
5. Worker는 인증, 사용자별 object namespace, optimistic concurrency와 공유 수명만
   담당합니다. 템플릿 편집·검증·압축·미리보기는 프론트에 둡니다.

로그인과 여러 기기 템플릿 동기화, 큰 payload의 30일 cloud share만 제공합니다.
커뮤니티 게시·검색·좋아요는 아직 제공하지 않습니다.
