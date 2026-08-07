# Web / Extension capability matrix

LinKU 웹은 기존 확장 프로그램의 기능과 화면 흐름을 유지하되, 브라우저 권한이
필요한 동작만 확장 프로그램 어댑터에 남깁니다. 공통 데이터 계약과 순수 로직은
`packages/`에서 함께 사용합니다.

| 기능 | Extension | Web | 공통 경계 |
| --- | --- | --- | --- |
| 통합 검색 | 학교 검색을 새 탭으로 엶 | 같은 검색 URL을 새 탭으로 엶 | URL과 화면 패턴 |
| 캠퍼스 바로가기 | Chrome 탭 및 스크립트 실행 | 안전한 외부 링크로 이동 | `@linku/platform` 바로가기 카탈로그 |
| 수강신청 새로고침, 학점 계산 | `chrome.scripting`으로 현재 학교 페이지에서 실행 | 브라우저 권한상 제공하지 않음 | 확장 전용 capability로 명시 |
| 공지 | 학교 RSS/HTML과 LinKU backend 공지 | 서버 route에서 같은 학교 피드를 읽고 학과 구독을 연결 | 피드 정의, 카테고리, 응답 타입 |
| Todo | Chrome storage에 개인 Todo 저장, eCampus 연동 | localStorage에 개인 Todo 저장, 서버 route로 eCampus 연동 | 타입, 마이그레이션, D-Day, 정렬, Markdown |
| 시간표 | 준비 중 화면 | 같은 준비 중 화면 | 현재 제품 상태를 동일하게 유지 |
| QR 생성 | 브라우저에서 생성 | 브라우저에서 생성 | 동일한 기능 계약 |
| 서버 시계 | 학교 서버 시간을 조회 | 인증된 서버 route가 허용된 학교 도메인만 조회 | 허용 도메인 정책 |
| 도서관 좌석 | 도서관 API 직접 연동 | 인증된 서버 route를 통해 연동 | API 응답 타입 |
| 템플릿 | 생성, 편집, 적용, 동기화, 공개, 복제, 좋아요 | 같은 흐름과 사용자 정의 링크 편집 | 템플릿/아이템 타입과 backend 계약 |
| 배너 | 공통 목록과 로컬 asset fallback | 공통 목록과 웹 asset fallback | `@linku/platform` 배너 카탈로그 |
| 로그인 | `chrome.identity` OAuth와 LinKU backend 연결 | NextAuth Google OAuth와 LinKU backend 연결 | 계정/backend 응답 타입 |
| eCampus 자격 증명 | Chrome storage 어댑터 | localStorage 어댑터 | AES-GCM 암호화 로직 |
| 링크/즐겨찾기 | 기존 바로가기와 템플릿 중심 | 계정별 링크/즐겨찾기 관리 | 안전한 HTTP(S)/내부 경로 정규화 |

## 외부 연결이 필요한 검증

- Google OAuth client와 redirect URI
- LinKU backend base URL 및 이메일 인증
- Vercel project/environment
- Chrome Web Store API 자격 증명
- 실제 eCampus 및 도서관 계정

위 값이 없는 로컬 환경에서는 대체 상태와 접근 제어까지 검증하고, 실제 계정
데이터를 전송하는 종단 간 검증은 자격 증명이 연결된 환경에서 수행합니다.
