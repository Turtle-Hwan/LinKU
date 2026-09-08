# LinKU

건국대학교 학생들이 자주 쓰는 교내외 서비스, 공지, Todo, 시간표와 직접 만든
바로가기 템플릿을 한곳에서 사용하는 Manifest V3 Chrome Extension입니다.

- [Chrome Web Store](https://chromewebstore.google.com/detail/linku/fmfbhmifnohhfiblebbdjlioppfppbgh?hl=ko)
- [GitHub Pages](https://turtle-hwan.github.io/LinKU)

개인 템플릿은 Chrome IndexedDB에 먼저 저장됩니다. Google 로그인은 선택 사항이며,
로그인한 경우 Supabase를 통해 여러 기기 동기화와 커뮤니티 게시 기능을 사용할 수
있습니다. 네트워크나 Supabase를 사용할 수 없어도 로컬 편집·적용·백업은 계속
동작합니다.

## 빠르게 열기

- Windows/Linux: `Ctrl + Shift + L`
- Mac: `Command + Shift + L`

단축키는 Chrome의 확장 프로그램 단축키 설정에서 변경할 수 있습니다.

## 건국대 학생들이 만든 서비스

학교 공식 사이트뿐 아니라 학생들이 만든 서비스도 연결합니다. 추가할 서비스는
GitHub Issue로 제안해 주세요.

- [쿠링](https://github.com/ku-ring): 건국대학교 공지 알리미
- [플레이쿠라운드](https://github.com/playkuround): 캠퍼스 안의 작은 놀이터
- [쿠스토랑](https://kustaurant.com/): 건대 맛집 탐색
- [언제볼까](https://when-will-we-meet.com/): 모임 날짜 정하기
- [쿠맵](https://github.com/KU-Barrier-Free/): 건국대학교 배리어프리 지도

## 시작하기

요구사항은 Node.js 24와 pnpm입니다.

```bash
git clone https://github.com/Turtle-Hwan/LinKU.git
cd LinKU
pnpm install
cp .env.development.example .env.development
pnpm run build:local
```

생성된 `dist/`를 `chrome://extensions`의 개발자 모드에서 "압축해제된 확장
프로그램을 로드합니다"로 선택합니다. `pnpm run dev`는 React UI 반복 작업용이며
`chrome.identity`, background service worker와 실제 extension storage를 검증하지
않습니다.

```bash
pnpm run lint
pnpm run test:templates
pnpm run test:timetable
pnpm run build:gh-pages
```

Supabase 로컬 스키마와 계정 기능 개발 방법은
[기여 가이드](docs/CONTRIBUTING.md)를 참고하세요.
계정 기능 없이 개발하려면 `VITE_SUPABASE_URL`과 `VITE_SUPABASE_PUBLISHABLE_KEY`를
비워 두면 됩니다.

## 문서

- [Architecture](docs/ARCHITECTURE.md): 런타임, 저장소와 데이터 흐름
- [Local-first](docs/LOCAL_FIRST.md): 로컬 저장·동기화·충돌·게시 계약
- [Contributing](docs/CONTRIBUTING.md): 개발 환경과 검증 기준
- [Observability](docs/OBSERVABILITY.md): Sentry 경계와 개인정보 정책
- [GA4 Data Taxonomy](docs/GA4-Data-Taxonomy.md): 분석 이벤트와 공개 GA 전송 정책

기능 제안이나 오류 제보는 GitHub Issue에 남겨 주세요.

## Special Thanks

- Logos designed by [pm_doyoo](https://www.instagram.com/pm_doyoo/)
- Cozy coding zone provided by [makers farm](https://www.instagram.com/makersfarm_konkuk) aka [lion](https://www.instagram.com/00_minwooky)
