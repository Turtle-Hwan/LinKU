# LinKU 디자인 패리티

LinKU의 웹 이식은 기존 Chrome 확장 프로그램의 기능과 화면 언어를 보존하는
작업입니다. 확장 프로그램 popup이 시각적 정본이며, 웹은 같은 요소를 더 넓은
화면에 반응형으로 배치합니다.

## 고정 규칙

- 글꼴: Pretendard
- 배경: 흰색
- 주 색상: `#00913a`
- 주 색상 hover: `#007a30`
- 기본 반경: `0.5rem`
- UI primitive: `@linku/ui`
- 공통 토큰: `@linku/ui/theme.css`

앱 코드에서 `@radix-ui/*`, `class-variance-authority`, `cmdk`, `sonner`,
`tailwind-merge`를 직접 가져오지 않습니다. 이 의존성은 `packages/ui`만
소유하며 앱의 ESLint 설정이 경계를 검사합니다.

## 그대로 유지할 요소

- 112×36 LinKU 로고와 검색 입력, Labs·웹·설정·GitHub 아이콘으로 구성한
  헤더
- `링크모음 / 공지사항 / 시간표 / Todo List` 순서의 네 개 탭
- 6열 grid, 2칸 또는 3칸 너비, 36px 연녹색 아이콘 원, 가운데 정렬 label을
  사용하는 바로가기 타일
- 얇은 회색 border, 흰 card, 작은 제목과 본문 위계
- extension banner와 기존 아이콘 asset

## 웹에서 허용되는 변경

- viewport에 따른 열 수, max-width, 여백, sticky 배치 조정
- mouse와 keyboard 접근성을 위한 link/button 의미 보완
- 공개 페이지의 SEO 문서 구조와 설명 문구
- 기존 기능에 필요한 loading, empty, error 상태

## 사용자 확인이 필요한 변경

- 새 색상 체계나 글꼴
- 큰 hero typography 또는 별도 marketing visual
- 새로운 card radius, shadow, gradient
- 기존 네 탭의 순서나 shortcut tile 구조 변경
- popup을 별도 desktop dashboard UI로 재해석하는 변경

UI를 수정한 뒤에는 웹 desktop/mobile 화면과 빌드된 extension popup을 함께
검증합니다. 두 화면의 동일 기능은 토큰과 primitive뿐 아니라 실제 배치와
상태 표현도 비교합니다.
