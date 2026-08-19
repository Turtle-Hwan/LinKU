# Local-first 경계

LinKU의 개인화 기능은 서버가 없어도 먼저 동작하고, 계정 기능은 그 위에 선택적으로
붙이는 구조를 사용합니다. 이 문서는 stateless 기반과 후속 stateful 계층 사이의
계약을 설명합니다.

## Stateless 기반

현재 기반에서 서버 없이 완결되는 기능은 다음과 같습니다.

| 데이터/기능 | 저장 또는 전달 위치 | 서버 장애 시 동작 |
| --- | --- | --- |
| 개인 템플릿 | Chrome IndexedDB `linku/templates` | 생성·조회·수정·삭제 가능 |
| 편집 draft | Chrome IndexedDB `linku/drafts` | 레거시 draft 1회 이관 보관 |
| 사용자 아이콘 | Chrome IndexedDB `linku/assets` | 업로드·이름 변경·삭제 가능 |
| 손상 레코드 | Chrome IndexedDB `linku/quarantine` | 원본 보존, 파일로 내보내기 |
| 전체 백업 | `linku-backup-*.json` 파일 | 내보내기·복원 가능 |
| 적용 중인 템플릿 ID | `chrome.storage.local` | popup 재실행 후 유지 |
| 작은 템플릿 공유 | GitHub Pages URL fragment | 서버 저장 없이 미리보기·가져오기 가능 |
| 큰 템플릿 공유 | `.linku.json` 파일 | 파일 전달로 내보내기·가져오기 가능 |

`drafts` store는 레거시 `localStorage` draft를 이관해 보관하는 자리이며
`saveTemplateDraft`/`loadTemplateDraft`로만 접근합니다. 에디터의 자동 draft
저장은 아직 연결되어 있지 않습니다. 다른 화면에서 `templateId === 0`은 번들
기본 템플릿을 뜻하므로 draft를 그 값으로 지칭하지 않습니다.

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

## 로컬 데이터 무결성

서버 사본도 원격 점검 수단도 없으므로 저장소 계층이 다음을 스스로 보장합니다.

- **식별자 발급**: `templateId`는 쓰기와 같은 transaction 안에서 사용 중인 최대
  값보다 크게 발급합니다. 시계가 뒤로 가도 기존 템플릿을 덮어쓰지 않습니다.
  호출부는 `templateId: 0`을 넘기고 저장소가 부여한 값을 돌려받습니다.
- **읽기 정규화**: 모든 레코드는 읽는 시점에 `normalizeStoredTemplate`을 거칩니다.
  격자를 벗어난 좌표, 중복된 항목 식별자, 빠진 시각은 보정하고 그 사실을 기록합니다.
- **격리**: 보정으로 살릴 수 없는 레코드는 삭제하지 않고 `quarantine` store로
  원본 그대로 옮긴 뒤 개수를 사용자에게 알립니다. 사용자는 파일로 내려받을 수
  있고, 삭제 여부는 사용자가 정합니다.
- **아이콘 재등록**: 인라인 이미지를 가진 항목의 `iconId`가 asset에 없으면 읽는
  시점에 등록해 양수 id를 부여합니다. 등록되지 않은 아이콘을 가진 항목은
  `linkFormSchema`가 거부해 이름·주소·위치까지 저장할 수 없게 되기 때문입니다.
- **사용 중 아이콘 보호**: 템플릿이 참조하는 아이콘은 삭제를 거부합니다.
- **저장 공간**: 확장 저장소는 best-effort 모드로 둡니다. 사용자의 "인터넷 사용
  기록 삭제"는 확장 저장소를 지우지 않지만, 디스크 압박 시 브라우저가 이 출처의
  데이터를 통째로 축출할 수는 있습니다. 드문 경우이고 계정 동기화가 붙으면
  유일본 조건 자체가 사라지므로, `unlimitedStorage` 권한으로 면제받는 대신 백업
  파일을 복구 경로로 둡니다. 저장 실패는 할당량 초과와 그 밖의 오류를 구분해
  안내합니다.
- **백업**: 템플릿과 아이콘 전체를 한 파일로 내보내고 복원할 수 있습니다. 복원은
  항상 새 식별자를 발급해 기존 템플릿을 덮어쓰지 않습니다.

DB schema를 바꿀 때는 `upgrade`에서 반드시 `oldVersion`을 분기합니다. 가드 없는
`createObjectStore`는 이미 이전 버전이 깔린 사용자 기기에서만 실패하며, 그 실패는
우리 쪽에서 복구할 수 없습니다.

## 후속 stateful 계층의 계약

계정 동기화 PR은 다음 원칙을 지켜 이 기반 위에 추가합니다.

1. IndexedDB 저장은 항상 먼저 완료하고 성공 UI를 반환합니다.
2. 동기화는 durable outbox로 별도 수행하며 네트워크 실패가 로컬 저장을 rollback하지
   않습니다.
3. DB schema를 확장할 때 version을 올리고 기존 `templates`, `drafts`, `assets`,
   `migrations` store를 그대로 보존합니다.
4. Google 로그인은 동기화와 여러 기기 사용을 위한 선택 기능입니다. 개인 템플릿
   편집 자체의 선행 조건이 아닙니다.
5. Worker는 인증, 사용자별 object namespace, optimistic concurrency와 공유 수명만
   담당합니다. 템플릿 편집·검증·압축·미리보기는 프론트에 둡니다.

stateful 계층이 추가되기 전에는 로그인, 여러 기기 동기화, cloud share, 커뮤니티
게시를 제공한다고 표시하지 않습니다.
