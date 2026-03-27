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
  - Android, iOS 앱 제공
- **[PlayKUround :: 캠퍼스 안의 작은 놀이터, 플레이쿠라운드]** [링크](https://github.com/playkuround)
  - Android, iOS 앱 제공
- **[KUstaurant :: 건대 맛집 탐색 쿠스토랑]** [링크](https://kustaurant.com/)
  - Web, App 제공
- **[언제볼까 :: 빠른 모임 날짜 약속]** [링크](https://when-will-we-meet.com/)
  - Web 제공
- **[쿠맵 :: 건국대학교 배리어프리 지도]** [링크](https://github.com/KU-Barrier-Free/)
  - Android, iOS 앱 제공

## Preview

![image](https://github.com/user-attachments/assets/86e3cc34-4aac-4d04-8ce9-053afa0232d8)

### 키보드 단축키

LinKU 확장 프로그램을 빠르게 열 수 있는 단축키:

- **Windows/Linux**: `Ctrl + Shift + L`
- **Mac**: `Command + Shift + L`

> [!tip]
> 단축키는 `chrome://extensions/shortcuts`에서 사용자 정의할 수 있습니다.

## Skills

- Chrome extension
- Vite + React + TypeScript
- tailwindcss + shad/cn

## How to Contribute

### 개발 환경 요구사항

- Node.js 24 LTS
- pnpm

```bash
git clone https://github.com/Turtle-Hwan/LinKU.git
cd LinKU
pnpm install
```

### 실행 방법

```bash
# 개발 서버 (Hot reload, console 로그 O, 버전 고정)
pnpm run dev

# 로컬 빌드 테스트 (console 로그 O, 버전 고정)
pnpm run build:local
# → dist 폴더를 chrome://extensions에 로드

# 프로덕션 빌드 (console 로그 X, 버전 자동 증가)
pnpm run build
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
<summary><b>환경 변수 설정 (Google Analytics)</b></summary>

Google Analytics를 사용하기 위해 환경 변수를 설정해야 합니다:

```bash
# .env.development 파일 생성
cp .env.development.example .env.development

# .env.development 파일을 열어서 VITE_GA_API_SECRET 값을 입력
```

**Google Analytics API Secret 발급 방법:**

1. [Google Analytics](https://analytics.google.com/) 접속
2. Admin → Data Streams → 해당 스트림 선택
3. Measurement Protocol API secrets → Create
4. 생성된 Secret value를 복사하여 `.env.development` 파일에 입력

</details>

<details>
<summary><b>Chrome Extension 자동 배포 설정 (For Maintainers)</b></summary>

이 프로젝트는 `main` 브랜치에 push/merge 시 Chrome Web Store에 자동으로 draft를 업로드하는 GitHub Actions workflow를 사용합니다.

### 동작 방식

- **자동화**: main 브랜치에 코드가 merge될 때마다 자동으로 빌드 후 Chrome Web Store에 draft 업로드
- **수동 심사**: draft 업로드만 자동화되며, 실제 심사 제출은 [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)에서 수동으로 진행
- **충돌 방지**: 심사 중일 때 새 커밋이 발생해도 draft만 업데이트되므로 심사 충돌 없음

### 1단계: Google Cloud Console 설정

#### 1.1 프로젝트 생성

1. [Google Cloud Console](https://console.cloud.google.com/)에 접속
2. 상단의 프로젝트 선택 드롭다운 클릭
3. "새 프로젝트" 선택
4. 프로젝트 이름 입력 (예: `LinKU Chrome Extension`)
5. "만들기" 클릭

#### 1.2 Chrome Web Store API 활성화

1. 좌측 메뉴에서 **"API 및 서비스" > "라이브러리"** 선택
2. 검색창에 `Chrome Web Store API` 입력
3. "Chrome Web Store API" 클릭
4. **"사용"** 버튼 클릭
   - ⚠️ 이 단계를 건너뛰면 나중에 API 호출 시 오류 발생!

#### 1.3 OAuth 동의 화면 설정

1. 좌측 메뉴에서 **"API 및 서비스" > "OAuth 동의 화면"** 선택
2. **User Type: "External"** 선택 후 "만들기" 클릭
3. **앱 정보** 입력:
   - 앱 이름: 임의로 입력 (예: `LinKU Upload`)
   - 사용자 지원 이메일: 본인 이메일
   - 개발자 연락처 정보: 본인 이메일
4. "저장 후 계속" 클릭
5. **범위** 페이지: 그냥 "저장 후 계속" 클릭 (범위는 나중에 CLI에서 자동 설정됨)
6. **테스트 사용자** 페이지: **⚠️ 매우 중요!**
   - **"ADD USERS"** 버튼 클릭
   - 본인 Gmail 주소 입력 (예: `your-email@gmail.com`)
   - "추가" 클릭
   - **이 단계를 건너뛰면 "액세스 차단됨" 오류 발생!**
7. "저장 후 계속" 클릭

#### 1.4 OAuth 클라이언트 ID 생성

1. 좌측 메뉴에서 **"API 및 서비스" > "사용자 인증 정보"** 선택
2. 상단의 **"+ 사용자 인증 정보 만들기"** 클릭
3. **"OAuth 클라이언트 ID"** 선택
4. 설정:
   - **애플리케이션 유형: "데스크톱 앱"**
   - 이름: 임의로 입력 (예: `Chrome Webstore Upload`)
5. "만들기" 클릭
6. 생성된 **Client ID**와 **Client Secret**을 복사하여 안전한 곳에 보관

### 2단계: OAuth Refresh Token 발급

#### 2.1 CLI 도구 실행

터미널에서 다음 명령어 실행:

```bash
npx chrome-webstore-upload-keys
```

#### 2.2 인증 정보 입력

CLI가 다음을 차례로 요청합니다:

1. **Client ID** 입력 (1.4 단계에서 복사한 값 붙여넣기)
2. **Client Secret** 입력 (1.4 단계에서 복사한 값 붙여넣기)
3. **Extension ID** 입력 (아래 참고)

**Extension ID 찾는 방법:**

- [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)에서 확장 프로그램 선택
- URL의 마지막 부분이 Extension ID입니다
- 예: `https://chrome.google.com/webstore/devconsole/.../fmfbhmifnohhfiblebbdjlioppfppbgh`
  → Extension ID: `fmfbhmifnohhfiblebbdjlioppfppbgh`

#### 2.3 브라우저 OAuth 인증

1. CLI가 자동으로 브라우저를 열고 Google 인증 페이지로 이동
2. **Google 계정 선택** (1.3.6에서 추가한 테스트 사용자 계정)
3. **"앱이 확인되지 않음"** 경고가 나타날 수 있음:
   - **"고급"** 클릭
   - **"[앱 이름](안전하지 않음)으로 이동"** 클릭
   - ✅ 본인이 만든 앱이므로 안전합니다!
4. **권한 승인**:
   - "Chrome Web Store에 액세스" 권한 확인
   - **"허용"** 클릭
5. 인증 완료 후 터미널로 돌아가서 **Refresh Token** 확인 및 복사

**⚠️ "액세스 차단됨: 앱이 테스트 중" 오류 발생 시:**

- 1.3.6 단계에서 테스트 사용자를 추가하지 않았거나
- 다른 Google 계정으로 로그인한 경우
- → Google Cloud Console로 돌아가서 테스트 사용자 추가 후 다시 시도

### 3단계: GitHub Secrets 설정

#### 3.1 GitHub Repository Settings 접속

1. GitHub 저장소 페이지 접속
2. 상단 메뉴에서 **"Settings"** 클릭
3. 좌측 메뉴에서 **"Secrets and variables" > "Actions"** 선택

#### 3.2 Secrets 추가

**"New repository secret"** 버튼을 클릭하여 다음 4개의 secret을 차례로 추가:

| Name                   | Value                                   |
| ---------------------- | --------------------------------------- |
| `CHROME_EXTENSION_ID`  | Extension ID (2.2에서 확인한 값)        |
| `CHROME_CLIENT_ID`     | OAuth Client ID (1.4에서 복사한 값)     |
| `CHROME_CLIENT_SECRET` | OAuth Client Secret (1.4에서 복사한 값) |
| `CHROME_REFRESH_TOKEN` | Refresh Token (2.3에서 복사한 값)       |

**각 secret 추가 방법:**

1. **Name** 필드에 위 표의 이름 입력 (대소문자 정확히)
2. **Secret** 필드에 해당 값 붙여넣기
3. **"Add secret"** 클릭
4. 4개 모두 추가될 때까지 반복

### 4단계: 배포 확인 및 심사 제출

#### 4.1 자동 배포 확인

1. `main` 브랜치에 코드 push/merge
2. GitHub 저장소의 **"Actions"** 탭에서 workflow 실행 확인
3. "Upload Chrome Extension Draft" workflow가 성공적으로 완료되면 ✅

#### 4.2 수동 심사 제출

1. [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) 접속
2. 확장 프로그램 선택
3. 좌측 메뉴에서 **"패키지"** 탭 확인
4. 새로 업로드된 draft 버전 확인
5. **"심사 제출"** 버튼 클릭
6. 심사 완료까지 대기 (보통 24시간~3일 소요)

**💡 Tip:**

- 심사 중일 때 새 커밋이 발생해도 draft만 업데이트되므로 안전
- 심사 완료 후 Developer Dashboard에서 수동으로 배포 가능

</details>

## Special Thanks

- Logos designed by [pm_doyoo](https://www.instagram.com/pm_doyoo/)
- Cozy coding zone provided by [makers farm](https://www.instagram.com/makersfarm_konkuk) aka [lion](https://www.instagram.com/00_minwooky)
