# LinKU :: 건국대학교 학생들을 위한 교내외 관련 페이지 모음 크롬 확장 프로그램

> [Chrome extension Link](https://chromewebstore.google.com/detail/linku/fmfbhmifnohhfiblebbdjlioppfppbgh?hl=ko&utm_source=ext_sidebar)  
> [GitHub Pages](https://turtle-hwan.github.io/LinKU)

> [!note]
> 자주 접속하는 학교 관련 여러 사이트들을 검색하기도 힘들고, 일일이 찾기도 힘들어 한 번에 모아주는 확장 프로그램을 만들어 봤어요.
>
> 부족한 점이나 이런 기능 추가되면 좋겠다는 의견이 있다면 Issue에 남겨주세요!  
>  시간 날 때마다 추가해볼게요.

> [!tip]
> Link + KU 라는 이름에 알맞게 건국대 공식 사이트들 뿐만 아니라, 건대 학생들이 직접 만들거나 창업한 서비스도 연결해보려 생각 중이에요.
>
> 추가로 아시는 정보가 있다면 언제든 기여 부탁드려요!

### Students Made Services of Konkuk University

- **[ku-ring :: 건국대학교 공지 알리미, 쿠링]** [링크](https://github.com/ku-ring)
  - Android, IOS 앱 제공
- **[PlayKUround :: 캠퍼스 안의 작은 놀이터, 플레이쿠라운드]** [링크](https://github.com/playkuround)
  - Android, IOS 앱 제공
- **[KUstaurant :: 건대 맛집 탐색 쿠스토랑]** [링크](https://kustaurant.com/)
  - Web, App 제공
- **[언제볼까 :: 빠른 모임 날짜 약속]** [링크](https://when-will-we-meet.com/)
  - Web 제공

## Preview

![image](https://github.com/user-attachments/assets/86e3cc34-4aac-4d04-8ce9-053afa0232d8)

## Skills

- Chrome extension
- Vite + React + TypeScript
- tailwindcss + shad/cn

## How to Contribute

```bash
git clone https://github.com/Turtle-Hwan/LinKU.git
cd LinKU
pnpm install
pnpm run dev
```

- react 환경으로 구성되어 있어 dev로 실행되는 화면이 그대로 적용됩니다.
- 로컬에서 extension에 적용하려면, build 후 dist 폴더를 chrome extension에서 불러오면 확인할 수 있습니다.

- 현재 dist 폴더는 extension 배포 용도로 배너 이미지를 제외하고 빌드합니다.
  - gh-pages는 extension에서 배너 이미지를 불러오기 위해 /banners 경로에 배너 이미지들과 정보가 담긴 banners.json을 함께 빌드합니다.
  - 코드 수정 시 auto rebuild를 원한다면, --watch 옵션을 붙이거나 `pnpm run watch` 를 사용하면 됩니다.

```js
//dist 폴더에 배너 이미지 제외하고 빌드
"build": "node scripts/updateVersion.js && tsc -b && vite build --mode production",

//지속 재빌드
"watch": "node scripts/updateVersion.js && tsc -b && vite build --watch --mode production",

//gh-pages 폴더에 배너 이미지 포함하여 빌드
"build:gh-pages": "tsc -b && vite build --mode gh-pages",
```

<details>
<summary><b>Chrome Extension 자동 배포 설정 (For Maintainers)</b></summary>

이 프로젝트는 `main` 브랜치에 push/merge 시 Chrome Web Store에 자동으로 draft를 업로드하는 GitHub Actions workflow를 사용합니다.

### 동작 방식

- **자동화**: main 브랜치에 코드가 merge될 때마다 자동으로 빌드 후 Chrome Web Store에 draft 업로드
- **수동 심사**: draft 업로드만 자동화되며, 실제 심사 제출은 [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)에서 수동으로 진행
- **충돌 방지**: 심사 중일 때 새 커밋이 발생해도 draft만 업데이트되므로 심사 충돌 없음

### GitHub Secrets 설정

다음 secrets를 GitHub repository settings에 추가해야 합니다:

```
CHROME_EXTENSION_ID - Chrome Web Store 확장 프로그램 ID
CHROME_CLIENT_ID - Google OAuth Client ID
CHROME_CLIENT_SECRET - Google OAuth Client Secret
CHROME_REFRESH_TOKEN - Google OAuth Refresh Token
```

### Google Cloud Console OAuth 설정 방법

1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트 생성
2. Chrome Web Store API 활성화
   - "API 및 서비스 > 라이브러리" 메뉴에서 "Chrome Web Store API" 검색 및 활성화
3. OAuth 동의 화면 설정
   - "API 및 서비스 > OAuth 동의 화면" 메뉴로 이동
   - User Type: External 선택 후 "만들기"
   - 앱 정보 입력 (앱 이름, 사용자 지원 이메일 등)
   - "저장 후 계속" 클릭
   - **중요:** "테스트 사용자" 섹션에서 본인 Gmail 주소 추가 (예: `your-email@gmail.com`)
4. "API 및 서비스 > 사용자 인증 정보" 메뉴로 이동
5. "OAuth 2.0 클라이언트 ID" 생성
   - 애플리케이션 유형: 데스크톱 앱
   - 이름: 임의로 입력 (예: Chrome Webstore Upload)
6. Client ID와 Client Secret 복사
7. Refresh Token 발급:
   ```bash
   npx chrome-webstore-upload-keys
   ```
   - CLI가 Client ID와 Client Secret 입력 요청
   - 브라우저에서 Google OAuth 인증 페이지 자동 열림
   - 인증 완료 후 Refresh Token이 터미널에 출력됨

### 심사 제출 방법

1. GitHub Actions에서 draft 업로드 완료 확인
2. [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) 접속
3. 업로드된 draft 확인
4. "심사 제출" 버튼 클릭하여 수동으로 심사 진행

</details>

## Special Thanks

- Logos designed by [pm_doyoo](https://www.instagram.com/pm_doyoo/)
- Cozy coding zone provided by [makers farm](https://www.instagram.com/makersfarm_konkuk) aka [lion](https://www.instagram.com/00_minwooky)
