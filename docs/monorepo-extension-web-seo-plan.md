# LinKU 모노레포 전환 + SEO 중심 웹사이트 병행 배포 계획

> Archived plan. `docs/IMPLEMENTATION_SPEC.md` is the only authoritative spec.
> This file may still describe the removed `apps/app` and subdomain split approach.

작성일: 2026-03-14  
대상: 현재 크롬 확장 중심인 LinKU 레포를, 확장 배포와 웹사이트 배포를 함께 가져가는 모노레포로 확장하는 계획

## 1. 현재 상태 요약

현재 레포는 사실상 크롬 확장 popup 앱이 메인이다.

- 확장 메인 화면은 [`MainLayout.tsx`](d:\_hobby\coding\LinKU\src\components\MainLayout.tsx) 기준 `500x600` 고정 크기다.
- `gh-pages` 빌드는 실질적으로 배너 이미지 서버 역할이 크다.
- 확장은 `host_permissions`에 `<all_urls>` 및 특정 학교 도메인을 두고 있다.
- 일부 기능은 확장 컨텍스트에서 현재 탭 URL 변경, 스크립트 주입, `chrome.storage` 사용, 타 사이트 요청 등 브라우저 권한에 의존한다.
- `eCampus` 관련 로직은 현재 웹 표준 앱이 아니라 확장 환경에 기대고 있으며, `fetch(..., { credentials: "include" })`를 사용해 학교 사이트 세션 쿠키 기반 동작을 하고 있다.

즉, 지금 상태를 그대로 “웹사이트도 같이 배포”하는 수준으로만 넓히면, 겉보기 웹사이트는 만들 수 있어도 SEO와 권한 의존 기능은 반쪽이 될 가능성이 높다.

이번 계획의 핵심은 아래 3개다.

1. 확장과 웹을 하나의 모노레포에서 관리한다.
2. SEO를 강하게 가져갈 수 있는 정적 웹사이트를 별도 앱으로 만든다.
3. 확장 전용 권한 기능은 “확장 브리지”와 “BFF” 중 어디까지 분리할지 명확히 정한다.

## 2. 목표 정의

이번 전환의 목표는 단순히 웹에서도 열리게 만드는 것이 아니다.

### 2.1 제품 목표

1. 크롬 확장은 계속 유지한다.
2. 별도의 공개 웹사이트를 배포한다.
3. 웹사이트는 구글 검색에서 잘 노출되도록 SEO를 적극 설계한다.
4. 확장에서 외부 브라우저로 열리던 기능 중 일부는 웹사이트 내부 라우트로 흡수한다.
5. 확장과 웹이 같은 코드/디자인/도메인 전략 아래 묶이도록 한다.

### 2.2 기술 목표

1. 모노레포 구조로 재편한다.
2. UI와 비즈니스 로직을 확장/웹이 공유할 수 있게 만든다.
3. SEO에 불리한 단일 SPA 구조를 피한다.
4. GitHub Pages 기반 정적 배포와 Chrome Web Store 배포를 둘 다 자동화한다.
5. 브라우저 권한 의존 기능은 웹에서도 가능한지/불가능한지 경계를 분리한다.

## 3. 가장 중요한 결론

먼저 결론부터 정리하면 다음이 가장 현실적이다.

### 3.1 추천 큰 그림

1. `apps/extension`: 지금의 크롬 확장 popup 앱
2. `apps/web`: SEO 중심 공개 웹사이트
3. `packages/ui`: 공유 UI 컴포넌트
4. `packages/core`: 링크 데이터, 도메인 로직, 공통 상태 모델
5. `packages/platform`: `chrome.*`와 웹 API 차이를 흡수하는 어댑터
6. `apps/bff` 또는 별도 서버리스: 웹에서 직접 못 하는 인증/세션/프록시 처리

### 3.2 기술 선택 추천

- 확장 앱: 현재처럼 React + Vite 유지
- 공개 웹: Astro 우선 추천
- SEO 핵심 페이지: 정적 사전 렌더링
- 인터랙티브 UI 일부: React island 또는 client component
- 데이터 경계: “공개 데이터는 정적/직접”, “권한 데이터는 BFF 또는 확장 브리지”

### 3.3 왜 Astro를 추천하나

GitHub Pages는 정적 사이트 호스팅이다. GitHub Docs는 GitHub Pages를 “HTML, CSS, JavaScript files straight from a repository”를 호스팅하는 정적 사이트 서비스라고 설명한다.  
출처: GitHub Docs, What is GitHub Pages?  
https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages

또 Astro는 공식 문서에서 GitHub Pages에 “static, prerendered Astro website”를 바로 배포할 수 있다고 안내한다.  
출처: Astro Docs, Deploy your Astro Site to GitHub Pages  
https://docs.astro.build/en/guides/deploy/github/

즉, SEO를 정말 챙길 목적이라면 “확장 popup용 React SPA를 그대로 public web에 복제”하기보다, “정적 HTML이 강한 웹앱”으로 웹을 따로 두는 편이 낫다.

### 3.4 Astro vs Next 비교

아래 비교는 이번 프로젝트의 실제 조건을 기준으로 정리한 것이다.

| 비교 항목 | Astro | Next.js | LinKU 기준 판단 |
| --- | --- | --- | --- |
| 기본 성향 | 콘텐츠/마케팅/문서/정적 페이지에 강함 | 풀스택 웹앱에 강함 | “SEO 사이트”만 보면 Astro 우세 |
| GitHub Pages 적합성 | 매우 좋음. 정적 배포와 잘 맞음 | 가능은 하나 `output: 'export'` 중심 제약이 큼 | GitHub Pages 단독 배포면 Astro 우세 |
| SEO 페이지 운영 | 매우 편함. 정적 HTML, Markdown, content collections 강점 | 충분히 강함. metadata/route 관리 우수 | 둘 다 가능, 문서형 운영은 Astro가 더 단순 |
| React 컴포넌트 재사용 | islands로 일부 재사용 쉬움 | React 네이티브라 가장 자연스러움 | popup UI 재사용은 Next가 더 직접적 |
| Google 로그인형 웹앱 | 가능하지만 별도 auth 조합과 SSR adapter 설계 필요 | 공식 auth 가이드, Route Handlers, Server Components, 세션 처리 흐름이 강함 | 로그인형 앱은 Next 우세 |
| 서버/API/BFF 내장성 | 가능하지만 adapter와 SSR 모드 전제가 필요 | Route Handlers와 서버 기능이 기본 경험에 가까움 | BFF까지 한 앱에서 묶으려면 Next 우세 |
| GitHub Pages만으로 로그인형 앱 구성 | 사실상 어려움 | 사실상 어려움 | 로그인형 앱은 둘 다 Pages 단독으로는 부적합 |
| 정적 + 동적 혼합 | `hybrid`/`server` 가능 | static/SSR/hybrid 조합 성숙 | 동적 비중이 커질수록 Next 쪽이 편함 |
| 인증 생태계 | 공식 인증 솔루션은 없음 | 인증 가이드와 호환 라이브러리 풀이 강함 | 운영형 인증은 Next 쪽 안정적 |
| 장기 확장성 | 콘텐츠 허브에는 매우 좋음 | 앱 플랫폼으로 확장하기 좋음 | “실사용 로그인 앱”이면 Next 재검토가 맞음 |

### 3.5 실사용 구글 로그인형 웹앱 목표일 때의 판단

이 전제를 넣으면 판단이 달라진다.

Astro 공식 문서도 인증에 대해 “There is no official authentication solution for Astro”라고 설명하고, 인증/보호 페이지/API endpoint가 필요하면 on-demand rendering과 adapter 구성을 전제로 한다.  
출처:

- Astro Authentication  
  https://v6.docs.astro.build/it/guides/authentication/
- Astro On-demand Rendering  
  https://docs.astro.build/en/guides/server-side-rendering/

반면 Next.js 공식 문서는 인증을 위한 전용 가이드를 제공하고, 인증/세션/인가를 분리해서 설명하며, 인증 라이브러리 사용을 권장한다. 또한 App Router의 Route Handlers를 통해 서버 엔드포인트를 같은 앱 안에서 둘 수 있다.  
출처:

- Next.js Authentication Guide  
  https://nextjs.org/docs/app/guides/authentication
- Next.js Route Handlers  
  https://nextjs.org/docs/15/app/getting-started/route-handlers-and-middleware

실무적으로는 Next.js + Auth.js 조합이 Google OAuth 같은 소셜 로그인으로 이어지기 가장 자연스럽다. Auth.js 공식 사이트도 Next.js 예시를 가장 전면에 보여주고 있다.  
출처: Auth.js  
https://authjs.dev/

즉, “SEO 잘 되는 공개 웹사이트”와 “실사용 Google 로그인형 웹앱”을 동시에 목표로 한다면, Astro를 무조건 우선 추천하기보다 다음 두 안 중 하나를 택하는 것이 더 현실적이다.

#### 안 A: 웹을 전부 Next.js로 통합

- `apps/web`: Next.js
- 배포: GitHub Pages가 아니라 Vercel/Cloudflare/Node 가능 호스팅
- 장점: 로그인, 세션, API, SEO를 한 프레임워크 안에서 묶기 쉬움
- 단점: 현재 GitHub Pages 중심 계획과 충돌

#### 안 B: 이원화 구조

- `apps/site`: Astro, GitHub Pages, SEO/랜딩/가이드 전담
- `apps/app`: Next.js, `app.` 서브도메인 또는 별도 도메인, Google 로그인형 실사용 앱
- 장점: SEO와 앱 책임이 깔끔하게 분리됨
- 단점: 앱이 2개라 운영 복잡도 증가

### 3.6 현재 목표를 반영한 수정 추천

현재 목표가 “실사용 구글 로그인형 웹앱”까지 포함된다면, 기존의 “Astro 우선 단일 웹앱” 추천은 약해진다.

수정 추천은 아래와 같다.

1. 공개 SEO 사이트만 GitHub Pages에 두고 싶다면 `Astro + Next` 이원화가 가장 적합
2. 웹앱이 장기적으로 메인이 될 가능성이 높다면 `Next.js`를 메인 웹으로 검토하는 것이 맞음
3. 다만 Next.js 메인 웹을 택하면 GitHub Pages는 더 이상 로그인형 앱의 주 배포지가 될 수 없음
4. 따라서 “GitHub Pages를 계속 메인 웹앱 호스팅으로 쓰고 싶다”와 “실사용 Google 로그인형 앱을 운영하고 싶다”는 요구는 같이 가기 어렵다

핵심은 이것이다.

- `SEO 랜딩/문서`: Astro가 편함
- `실사용 Google 로그인형 앱`: Next가 훨씬 자연스러움
- `GitHub Pages 단독`: 로그인형 앱에는 부적합

## 4. 웹사이트 제품 방향

## 4.1 메인 페이지 방향

사용자 요구사항:

- 웹사이트의 메인 페이지는 크롬 확장의 메인 페이지와 동일한 크기의 화면을 유지
- 다만 데스크탑 넓은 화면을 더 잘 활용
- 별도의 완전한 데스크탑 전용 앱처럼 다시 설계하지는 않음

이를 반영한 권장 구조는 아래와 같다.

### 추천 레이아웃: “중앙 앱 카드 + 양옆 설명/탐색 구조”

1. 중앙에는 현재 popup과 동일한 `500x600` 비율의 “앱 카드”를 유지
2. 좌측에는 서비스 소개, 핵심 기능, 설치 유도, 학교 생활 문제 해결 포인트
3. 우측에는 인기 기능 바로가기, 스크린샷, 최신 공지, 사용 가이드, 웹 전용 바로가기
4. 카드 아래로는 SEO용 long-form 섹션을 길게 배치

이렇게 하면 얻는 장점:

- 확장 사용자에게 익숙한 UI를 유지
- 디자인/구현 재사용이 가능
- 데스크탑 공간을 낭비하지 않음
- 구글이 읽을 수 있는 텍스트 콘텐츠를 메인 페이지에 충분히 넣을 수 있음

### 메인 페이지에 반드시 있어야 할 섹션

1. LinKU가 무엇인지 한 문단으로 설명
2. 어떤 학교 서비스/학생 서비스로 연결되는지
3. 확장 설치 CTA
4. 웹에서 바로 쓸 수 있는 기능 CTA
5. 대표 기능 설명
6. FAQ
7. 스크린샷
8. 업데이트 내역 또는 운영 철학

이유는 단순하다. SEO는 “툴이 있다”보다 “검색 의도에 맞는 읽을 수 있는 페이지”가 중요하기 때문이다.

Google Search Central은 “Google primarily finds pages through links”라고 설명하고, 결국 유용한 콘텐츠와 잘 연결된 페이지 구조가 중요하다는 흐름을 일관되게 강조한다.  
출처: Google SEO Starter Guide  
https://developers.google.com/search/docs/fundamentals/seo-starter-guide

## 4.2 메인 페이지 와이어프레임 초안

```text
+--------------------------------------------------------------+
| 좌측 소개/가치                | 중앙 500x600 앱 카드 | 우측 CTA/가이드 |
| - 학교 생활 링크 허브         |                   | - Chrome 설치   |
| - TODO / eCampus 정리         |  popup 동일 UI      | - 웹 기능 바로가기 |
| - 학생 제작 서비스 연결       |                   | - 인기 기능      |
+--------------------------------------------------------------+
| 아래 섹션: 기능 설명 / FAQ / 학교 서비스 소개 / 검색 유입용 문서 |
+--------------------------------------------------------------+
```

### 데스크탑 대응 원칙

- 앱 카드 자체는 popup 크기를 유지
- 바깥 레이아웃만 넓은 화면 활용
- 반응형은 “확장형 레이아웃” 수준으로만 적용
- 메인 앱 내부를 데스크탑 전용으로 재설계하지 않음

## 4.3 외부 브라우저로 열리던 기능의 웹 흡수 방향

현재 확장에서는 `window.open()` 또는 탭 이동으로 처리하는 기능이 적지 않다.  
웹사이트가 생기면 이 중 일부는 웹 내부 라우트로 흡수하는 편이 더 깔끔하다.

### 권장 분류

#### A. 웹 내부 페이지로 흡수 가능한 기능

- 서비스 소개 페이지
- 배너/공지/추천 링크
- 링크 모음 카테고리 페이지
- 자주 찾는 학교 서비스 안내 페이지
- 학생 제작 서비스 큐레이션 페이지
- 사용 가이드 / FAQ / 업데이트 노트

#### B. 웹 내부 도구 페이지로 확장 가능한 기능

- Todo 관련 시각화
- 링크 북마크/핀
- 시간표 안내
- 학사 일정 모음
- 즐겨찾기 허브

#### C. 여전히 확장 전용이어야 하는 기능

- 현재 활성 탭 URL 변경
- 현재 페이지 DOM에 스크립트 주입
- `chrome.scripting.executeScript`
- `chrome.tabs.update/query`
- `chrome.storage` 이벤트 연동
- 타 사이트 세션/쿠키 기반 privileged 요청

이 분리를 먼저 해두지 않으면, 웹으로 옮기는 과정에서 “보이는 건 웹인데 실제론 확장이 없으면 안 되는 페이지”가 대량으로 생기게 된다.

## 5. 모노레포 구조 제안

## 5.1 추천 구조

```text
LinKU/
  apps/
    extension/
    web/
    bff/                  # 필요 시
  packages/
    ui/
    core/
    platform/
    seo/
    shared-types/
    config/
  public-assets/
    banners/
    images/
  pnpm-workspace.yaml
  package.json
```

## 5.2 역할 정의

### `apps/extension`

- 기존 popup 앱
- Chrome Manifest, permissions, Web Store 배포
- 확장 브리지 기능 담당

### `apps/web`

- 공개 웹사이트
- SEO 핵심 페이지
- 설치 유도, 기능 소개, 일부 웹 전용 도구 페이지
- GitHub Pages 배포 대상

### `apps/bff`

- 정적 호스팅으로 해결 안 되는 API 프록시
- 세션 인증 대행
- rate limit / caching / sanitizing
- 웹에서 직접 접근 불가한 학교 시스템과의 중계 계층

### `packages/ui`

- 버튼, 카드, 탭, 배너, 로고, 리스트
- popup 카드용 컴포넌트
- 웹용 프레임/레이아웃 요소

### `packages/core`

- 링크 메타데이터
- 카테고리 모델
- 공통 도메인 로직
- 공통 analytics event schema

### `packages/platform`

- `chrome.*` 어댑터
- 웹용 `localStorage/indexedDB` 어댑터
- 브라우저 capability 체크

### `packages/seo`

- route metadata
- sitemap 생성
- structured data 생성
- canonical URL 유틸

## 5.3 추천 패키지 매핑

현재 코드 기준으로 다음은 공유 후보가 높다.

- 링크 목록/메타 정보
- 배너 데이터
- 로고/아이콘
- 일반 UI 컴포넌트
- analytics schema

다음은 분리 추상화가 필요하다.

- `chrome.storage` 의존 로직
- `chrome.tabs` 및 `chrome.scripting` 의존 로직
- 세션 쿠키 전제 API 호출

## 6. SEO 전략

## 6.1 결론: Search Console 등록만으로는 부족하다

Search Console은 매우 중요하지만, 그것만으로 순위가 올라가는 개념은 아니다.

Google 문서 기준으로 Search Console은 사이트가 Google Search에서 어떻게 보이고, 어떻게 크롤링/인덱싱되는지 “이해하고 모니터링”하는 도구다. 또한 sitemap 제출은 힌트일 뿐, 보장 수단이 아니다.  
출처:

- Get started with Search Console  
  https://developers.google.com/search/docs/monitor-debug/search-console-start
- Build and submit a sitemap  
  https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap

특히 Google은 sitemap 제출에 대해 “merely a hint”이며, 다운로드/크롤링 보장이 아니라고 설명한다.  
출처: Build and submit a sitemap  
https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap

따라서 Search Console 등록은 필수이지만, 그것은 SEO 운영 도구이지 “순위 부스팅 스위치”가 아니다.

## 6.2 커스텀 도메인이 유리한가?

### 짧은 답

네. “도메인 자체가 마법처럼 랭킹을 올린다”까지는 아니지만, GitHub Pages의 기본 `github.io/<repo>`보다 자체 도메인을 쓰는 것이 장기 SEO 전략에 훨씬 유리하다.

### 이유

1. 브랜드 신뢰도와 클릭률 측면에서 유리
2. 링크 축적을 한 canonical 도메인으로 모을 수 있음
3. `github.io/<repo>` 경로형 URL보다 깔끔한 정보 구조를 만들기 쉬움
4. Search Console 관리와 사이트 자산 분리도 명확해짐
5. 추후 Pages 외 호스팅으로 옮겨도 브랜드 URL을 유지 가능

GitHub Docs는 GitHub Pages에서 custom domain을 공식 지원하고, apex와 `www`를 함께 구성하는 것도 가능하다고 설명한다. 특히 `www` 서브도메인을 항상 권장하고, `www`가 더 안정적이라고 안내한다.  
출처: About custom domains and GitHub Pages  
https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages

### 추천

- 가능하면 `www`를 메인 canonical로 사용
- apex도 같이 연결하되 자동 redirect 구성
- `github.io` 주소는 canonical에서 제외
- Search Console에서는 최소한 `www`와 non-`www`를 모두 확인
- 커스텀 도메인 전환 시 old/new 속성을 함께 모니터링

GitHub Docs는 apex와 `www`를 함께 설정했을 때 redirect가 생성될 수 있다고 설명한다.  
출처: About custom domains and GitHub Pages  
https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages

Google Search 문서도 `www`와 non-`www` 버전을 모두 확인하고, 대체 도메인에서 선호 도메인으로 `301` redirect를 두는 것을 권장한다.  
출처: Google Search Crawling and Indexing FAQ  
https://developers.google.com/search/help/crawling-index-faq

## 6.3 `.com`, `.dev`, `.kr` 중 무엇이 좋은가

### 추천 우선순위

1. 브랜드와 사용자를 가장 잘 설명하는 도메인
2. 짧고 기억하기 쉬운 도메인
3. 장기 운영 시 어색하지 않은 도메인

### 실무 판단

- `.com`: 가장 무난하고 설명 비용이 적다
- `.dev`: 개발자 제품 느낌이 강하다. 학생 대상 생활 도구에는 브랜딩상 살짝 덜 맞을 수 있다
- `.kr`: 한국/학교 맥락에 잘 맞고, 로컬 타깃이라는 신호를 주기 쉽다

### 내 추천

LinKU가 “학교 생활 허브 / 학생 도구” 성격이 강하므로,

- 1순위: `.com` 또는 `.kr`
- 2순위: 필요 시 `.dev` 보조 확보

도메인 TLD 자체보다 더 중요한 것은 다음이다.

1. canonical 일관성
2. title/meta/structured data
3. 검색 의도에 맞는 랜딩 페이지
4. 링크 가능하고 읽을 수 있는 콘텐츠

## 6.4 GitHub Pages 위에서 SEO를 잘 하려면

GitHub Pages는 정적 호스팅이므로, 오히려 SEO에 유리한 구성을 만들 수 있다.  
다만 전제는 “HTML이 빌드 시점에 충분히 생성되어야 한다”는 것이다.

### 반드시 해야 할 것

1. 정적 라우트 생성
2. route별 고유 `title`, `meta description`
3. canonical URL
4. `robots.txt`
5. `sitemap.xml`
6. Open Graph / Twitter card
7. structured data
8. 의미 있는 URL 구조
9. 404 페이지

Google은 canonical에 대해 `rel="canonical"`을 권장하고, redirect도 중복 URL 정리에 유효하다고 설명한다.  
출처:

- Canonical URLs  
  https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls

Google은 JavaScript 기반 사이트에서도 `rel="canonical"`을 적절히 넣고, SPA 라우팅 시 fragment 대신 History API를 사용하라고 안내한다.  
출처: JavaScript SEO Basics  
https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics

### 추천 route 예시

```text
/
/install
/features
/features/todo
/features/ecampus
/features/schedule
/guides
/guides/how-to-use-linku
/guides/install-chrome-extension
/services
/services/konkuk-portal
/services/ecampus
/faq
/updates
```

### 중요한 SEO 방향

현재처럼 확장 popup 하나만 있는 구조는 검색 유입 포인트가 약하다.  
SEO를 키우려면 “기능 중심 페이지”보다 “검색 의도 중심 페이지”가 더 많아야 한다.

예시:

- “건국대 ecampus 할 일 확인”
- “건국대 사이트 모음”
- “건국대 포털 바로가기”
- “건국대 학사일정 확인”
- “건국대 학생 서비스 링크”

이 검색 의도별 랜딩 페이지를 웹에 만들면 확장 설치 유입과 자연 검색 유입을 동시에 받을 수 있다.

추가로, Google은 사이트 이동 시 “한 번에 하나씩 바꾸기”를 권장한다.  
즉, 이번 전환에서도 아래 순서가 안전하다.

1. 먼저 custom domain + canonical + redirect 체계 정리
2. 그 다음 웹 구조 확장
3. 그 다음 대규모 디자인 개편 또는 정보 구조 개편

출처: How to move a site  
https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes

## 6.5 사이트 렌더링 방식 추천

### 추천: Astro + React islands

이유:

1. 정적 사전 렌더링이 강함
2. route별 meta 관리가 편함
3. 지금 React 컴포넌트를 일부 재사용 가능
4. GitHub Pages 배포 공식 가이드 존재
5. 마케팅 페이지와 인터랙티브 앱을 섞기 좋음

### 비추천: 현재 Vite SPA 그대로 복제

이유:

1. route별 HTML이 약하다
2. soft 404/metadata/canonical 관리가 까다롭다
3. SEO용 긴 문서/가이드 운영이 불편하다
4. popup 앱 구조와 공개 사이트 구조가 섞여버린다

## 7. 확장-웹-서버 권한 구조 계획

## 7.1 현재 확장의 권한 성격

현재 manifest에는 다음 특징이 있다.

- `activeTab`
- `scripting`
- `storage`
- `<all_urls>` 및 학교 관련 host permissions

또 현재 로직은 `fetch(..., { credentials: "include" })`로 학교 서비스 세션을 활용한다.

이것이 웹에서 그대로 가능한지는 별도 문제다.

## 7.2 웹으로 가면 왜 문제가 생기나

일반 웹 페이지는 same-origin policy와 CORS 제약을 받는다.

MDN은 브라우저가 cross-origin HTTP requests를 제한하며, 다른 origin 응답에 적절한 CORS 헤더가 없으면 웹 애플리케이션은 직접 요청할 수 없다고 설명한다.  
출처: MDN CORS  
https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS

또 `credentials: "include"`는 브라우저가 쿠키 같은 credentials를 요청에 포함할지 결정하지만, 이것도 cross-origin 제약과 서버 CORS 허용 여부를 넘어서지는 못한다.  
출처: MDN Request.credentials  
https://developer.mozilla.org/en-US/docs/Web/API/Request/credentials

즉 웹앱으로 바꾸면 다음이 즉시 문제 된다.

1. 학교 서버가 웹 origin에 CORS 허용을 안 하면 막힘
2. 세션 쿠키가 cross-site 요청에서 기대대로 안 붙을 수 있음
3. 응답의 `Set-Cookie` 처리도 제약을 받음
4. 확장처럼 `<all_urls>` 권한으로 우회할 수 없음

## 7.3 확장을 통해 웹사이트가 통신하는 구조는 가능한가

### 짧은 답

기술적으로는 가능하다. 다만 “보조 경로”로는 좋지만 “정식 메인 경로”로 삼기에는 제약이 크다.

Chrome 공식 문서상, 웹 페이지가 확장과 연결하려면 extension manifest에 `externally_connectable`을 선언해야 하며, `matches`에 허용할 웹 origin을 명시해야 한다. 문서에는 이 키가 없으면 웹 페이지는 연결할 수 없다고 나온다.  
출처: Chrome Extensions `externally_connectable`  
https://developer.chrome.com/docs/extensions/reference/manifest/externally-connectable

또 확장 서비스 워커나 extension page는 host permissions가 있으면 자신의 origin 밖 remote server와 통신할 수 있다.  
출처: Chrome Extensions cross-origin network requests  
https://developer.chrome.com/docs/extensions/develop/concepts/network-requests

### 가능 시나리오

1. 사용자가 웹사이트 방문
2. 웹사이트가 설치된 LinKU 확장에 메시지 전송
3. 확장이 privileged fetch 수행
4. 확장이 sanitized result를 웹에 반환

### 하지만 한계가 큼

1. 확장이 설치된 사용자에게만 동작
2. Chrome/Chromium 의존성이 커짐
3. 웹사이트 단독 제품으로는 완결되지 않음
4. 검색 엔진 크롤러는 확장을 설치하지 않음
5. 비로그인 사용자/비설치 사용자는 기능이 깨짐
6. 보안/권한/메시지 계약 관리가 필요

### 그래서 추천하는 위치

확장 브리지는 “있으면 더 편한 가속 경로”로 두고, 웹의 핵심 기능 의존성으로 두지 않는 것이 좋다.

## 7.4 BFF가 필요한가?

### 결론

권한형 데이터 기능을 웹에서도 진짜 제품으로 제공할 생각이라면, 결국 BFF가 필요할 가능성이 높다.

이유:

1. GitHub Pages는 정적 호스팅이라 서버 로직이 없다
2. 학교 서비스 CORS/세션 정책은 웹앱 친화적으로 열려 있지 않을 가능성이 크다
3. 웹은 확장처럼 host permissions 우회가 안 된다
4. 인증/세션/캐시/에러 제어를 안정적으로 하려면 중간 계층이 필요하다

### 권장 전략

#### 공개 SEO 사이트

- GitHub Pages 정적 배포

#### 권한형 API

- 별도 BFF
- 가능하면 `api.<custom-domain>` 또는 `/api/*` 구조

### BFF 후보

1. Cloudflare Workers
2. Vercel Functions
3. Railway / Fly / Render 같은 소형 백엔드

Cloudflare Workers는 custom domain/route 기반으로 프록시 계층을 둘 수 있고, `fetch()`로 upstream 호출이 가능하다.  
출처:

- Cloudflare Workers Routes and domains  
  https://developers.cloudflare.com/workers/configuration/routing/
- Cloudflare Workers Fetch API  
  https://developers.cloudflare.com/workers/runtime-apis/fetch/

Vercel Functions도 서버리스 함수로 API/BFF 역할을 둘 수 있다.  
출처: Vercel Functions  
https://vercel.com/docs/functions/

### 추천 판단

- 웹이 단순 소개/링크/SEO 유입용이면 BFF 없이도 가능
- 웹에서 eCampus/Todo 같은 로그인형 기능까지 하려면 BFF를 전제로 잡는 편이 안전

## 7.5 권한 전략 추천

### 전략 A: 확장 브리지 중심

구조:

- 웹 → 확장 → 외부 사이트

장점:

- 빠르게 붙일 수 있음
- 현재 확장 권한을 재활용 가능

단점:

- 확장 설치 의존
- SEO/공개 웹 완결성 부족
- Chrome 생태계 종속

### 전략 B: BFF 중심

구조:

- 웹 → BFF → 외부 사이트

장점:

- 웹 단독 제품으로 성립
- 브라우저 제약 감소
- 확장과 웹이 같은 API를 공유 가능

단점:

- 서버 운영 필요
- 인증/보안/로그 관리 필요

### 전략 C: 혼합형

구조:

- 공개 기능: 정적 웹
- 권한형 기능: BFF
- 설치 사용자 가속 경로: 확장 브리지

### 최종 추천

혼합형이 가장 좋다.

1. SEO와 공개 유입은 정적 웹이 담당
2. 웹 단독 사용성은 BFF가 보장
3. 설치 사용자는 확장 브리지로 더 빠르거나 더 많은 기능 제공

## 8. 추천 아키텍처

## 8.1 앱별 책임 분리

### `apps/web`

- 정적 콘텐츠
- 기능 소개
- FAQ
- 설치 유도
- 일부 공개형 도구
- SEO 전담

### `apps/extension`

- popup 앱
- 탭 주입 기능
- same-host 편의 기능
- 브라우저 권한 활용
- 고급 개인화

### `apps/bff`

- 로그인형 데이터 중계
- 캐시
- 인증 보조
- 학교 시스템 장애/응답 변화 대응

## 8.2 UI 공유 전략

공유할 것:

- 로고/컬러/브랜드 토큰
- 카드 UI
- 탭/버튼/배너
- 링크 카탈로그 데이터

분리할 것:

- popup 고정 레이아웃
- SEO 레이아웃
- 웹 랜딩 섹션
- 브라우저 API 직접 호출부

## 8.3 브라우저 API 추상화 예시

```ts
export interface StoragePort {
  get<T>(key: string): Promise<T | undefined>;
  set<T extends Record<string, unknown>>(data: T): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface BrowserActionPort {
  openUrl(url: string): void;
  updateCurrentTab?(url: string): Promise<void>;
  injectScript?(tabId: number, files: string[]): Promise<void>;
}
```

확장에서는 `chrome.storage`, `chrome.tabs`, `chrome.scripting` 구현체를 쓰고, 웹에서는 `localStorage` 또는 noop 구현체를 쓰게 하면 된다.

## 9. 배포 전략

## 9.1 배포 대상

1. Chrome Web Store
2. GitHub Pages
3. 필요 시 별도 BFF 호스팅

## 9.2 GitHub Pages 배포 전략

권장 방향:

- `apps/web`만 정적 빌드해서 GitHub Pages로 배포
- 기존 배너 이미지는 `apps/web/public` 또는 별도 shared asset로 정리
- `github.io` 주소와 custom domain을 동시에 관리하되 canonical은 custom domain으로 통일

## 9.3 GitHub Actions 설계 초안

### 워크플로우 1: Extension

- trigger: `main` push + extension 관련 경로 변경
- build `apps/extension`
- zip/package
- Chrome Web Store draft 업로드

### 워크플로우 2: Web

- trigger: `main` push + `apps/web`, `packages/ui`, `packages/core`, `packages/seo` 변경
- build `apps/web`
- sitemap/robots/canonical 확인
- GitHub Pages 배포

### 워크플로우 3: BFF

- trigger: `apps/bff` 변경
- 별도 플랫폼 배포

### 워크플로우 4: Integration checks

- shared package 빌드 검사
- route metadata 검사
- broken link 검사

## 10. SEO 실행 체크리스트

## 10.1 필수

1. custom domain 연결
2. Search Console 등록
3. `sitemap.xml`
4. `robots.txt`
5. canonical 통일
6. route별 고유 title/description
7. FAQ/Organization/SoftwareApplication structured data
8. Open Graph 이미지
9. 404/redirect 정책

## 10.2 강하게 추천

1. `/guides/*` 문서형 콘텐츠
2. 학교 서비스별 landing page
3. 확장 설치 가이드 페이지
4. changelog / updates
5. screenshots / use cases
6. 검색어 기반 내부 링크 구조

## 10.3 콘텐츠 방향

메인 키워드 예시:

- 건국대 사이트 모음
- 건국대 ecampus
- 건국대 포털 바로가기
- 건국대 학사 일정
- 건국대 학생 서비스
- 건국대 링크 모음

주의:

SEO는 키워드 나열보다 실제로 검색 의도를 해결하는 페이지 묶음이 중요하다.

## 11. 구현 단계 계획

## 11.1 Phase 1: 구조 분리

1. 모노레포 스캐폴딩
2. 기존 popup 앱을 `apps/extension`로 이동
3. 공통 UI/데이터를 `packages/*`로 추출
4. 기존 gh-pages 자산 구조 정리

성공 기준:

- 확장 앱이 이전과 동일하게 빌드/동작
- 공통 패키지 분리 완료

## 11.2 Phase 2: SEO 웹 MVP

1. `apps/web` Astro 생성
2. 메인 랜딩 페이지 구현
3. popup 카드 재사용
4. install / features / faq / guides 초안 생성
5. sitemap, robots, canonical, OG 설정
6. GitHub Pages 자동 배포 연결

성공 기준:

- 검색 엔진이 읽을 수 있는 정적 페이지 다수 확보
- 첫 검색 유입 기반 확보

## 11.3 Phase 3: 기능 라우트 확장

1. 외부 브라우저로 열리던 기능 중 웹 흡수 가능한 페이지 전환
2. 서비스 상세 페이지 생성
3. 학교 서비스별 랜딩/가이드 페이지 추가
4. 확장 설치 유도 문구/배너 삽입

성공 기준:

- 웹 자체만으로도 탐색 가치가 있음
- 확장 설치 전환 퍼널이 생김

## 11.4 Phase 4: 데이터 권한 재설계

1. 기능을 공개형/권한형으로 분리
2. 확장 브리지 PoC
3. BFF 필요 범위 식별
4. BFF 최소 구현

성공 기준:

- “웹에서도 되는 기능”과 “확장/BFF가 필요한 기능”이 명확

## 11.5 Phase 5: 운영 최적화

1. Search Console 운영
2. index coverage 모니터링
3. query/landing page 분석
4. FAQ 및 가이드 확장
5. structured data 보강

## 12. 리스크와 대응

## 12.1 리스크: 웹에서 eCampus가 안 될 수 있음

가능성 높음.  
학교 측 CORS, 세션 쿠키 정책, 로그인 정책 때문에 일반 웹앱에서는 막힐 수 있다.

대응:

- 초기부터 BFF 가능성을 열어둔다
- 확장 브리지는 보조 수단으로만 둔다

## 12.2 리스크: SEO용 웹이 popup 복제품이 되어버림

이 경우 검색 유입이 약하다.

대응:

- 기능 소개/가이드/FAQ/서비스 상세 페이지를 별도 운영

## 12.3 리스크: 모노레포 전환 중 확장 빌드가 깨질 수 있음

대응:

- `apps/extension` 이전 후 먼저 빌드 안정화
- 웹은 그 다음 붙인다

## 12.4 리스크: GitHub Pages 경로/asset 문제가 생김

현재도 `gh-pages`가 이미지 서버 성격이 있으므로 경로 설계를 먼저 통일해야 한다.

대응:

- 절대 URL 상수 제거
- env 기반 site URL 주입
- asset origin 정책 재정리

## 13. 최종 추천안

이번 상황에서 가장 현실적이고 좋은 방향은 아래다.

### 추천안

1. 레포를 모노레포로 전환
2. 확장은 React + Vite 유지
3. 웹은 Astro 기반 SEO 사이트로 별도 운영
4. 메인 페이지는 중앙 500x600 앱 카드 + 양옆/하단 SEO 콘텐츠 구조
5. custom domain 연결
6. Search Console 등록
7. 권한형 기능은 장기적으로 BFF 도입
8. 확장 브리지는 설치 사용자 보조 기능으로만 사용

### 이 안이 좋은 이유

1. 현재 자산을 많이 재사용할 수 있다
2. 확장 사용자 경험을 깨지 않는다
3. 웹 SEO를 제대로 챙길 수 있다
4. 데이터 권한 문제를 억지로 프런트에서 해결하지 않게 된다
5. 장기적으로 확장과 웹이 서로 유입을 만들어줄 수 있다

## 14. 실제 조사 결과 요약

### 도메인 / GitHub Pages / SEO

- GitHub Pages는 정적 사이트 호스팅
- custom domain 공식 지원
- GitHub는 `www` 사용을 권장
- custom domain은 SEO “운영 전략” 측면에서 유리
- Search Console은 모니터링/인덱싱 도움 도구이지 랭킹 스위치는 아님
- sitemap 제출은 힌트일 뿐 보장 아님

### 확장과 웹의 통신

- 웹 페이지 → 확장 메시지 전송은 `externally_connectable` 설정 시 가능
- 확장은 host permissions가 있으면 원격 서버와 cross-origin 통신 가능
- 하지만 content script는 여전히 cross-origin 제약을 받음

### 쿠키 / CORS / 웹 단독 기능

- 일반 웹앱은 same-origin policy와 CORS 제약을 받음
- `credentials: "include"`만으로 문제 해결되지 않음
- 웹에서 로그인형 외부 서비스까지 커버하려면 BFF가 필요할 가능성이 큼

## 15. 참고 자료

- GitHub Docs, What is GitHub Pages?  
  https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages

- GitHub Docs, About custom domains and GitHub Pages  
  https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages

- Astro Docs, Deploy your Astro Site to GitHub Pages  
  https://docs.astro.build/en/guides/deploy/github/

- Astro Docs, Islands Architecture  
  https://docs.astro.build/ko/concepts/islands/

- Astro Docs, Content Collections  
  https://docs.astro.build/en/guides/content-collections/

- Astro Docs, Server-side Rendering  
  https://docs.astro.build/en/guides/server-side-rendering/

- Astro Docs, Authentication  
  https://v6.docs.astro.build/it/guides/authentication/

- Next.js Docs  
  https://nextjs.org/docs

- Next.js Authentication Guide  
  https://nextjs.org/docs/app/guides/authentication

- Next.js Route Handlers  
  https://nextjs.org/docs/15/app/getting-started/route-handlers-and-middleware

- Next.js Metadata and OG Images  
  https://nextjs.org/docs/app/getting-started/metadata-and-og-images

- Next.js Static Exports  
  https://nextjs.org/docs/pages/guides/static-exports

- Auth.js  
  https://authjs.dev/

- Google Search Central, SEO Starter Guide  
  https://developers.google.com/search/docs/fundamentals/seo-starter-guide

- Google Search Central, Get started with Search Console  
  https://developers.google.com/search/docs/monitor-debug/search-console-start

- Google Search Central, Build and submit a sitemap  
  https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap

- Google Search Central, Canonical URLs  
  https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls

- Google Search Central, JavaScript SEO Basics  
  https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics

- Chrome Extensions, `externally_connectable`  
  https://developer.chrome.com/docs/extensions/reference/manifest/externally-connectable

- Chrome Extensions, cross-origin network requests  
  https://developer.chrome.com/docs/extensions/develop/concepts/network-requests

- Chrome Extensions, `chrome.cookies`  
  https://developer.chrome.com/docs/extensions/reference/api/cookies

- MDN, CORS  
  https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS

- MDN, `Request.credentials`  
  https://developer.mozilla.org/en-US/docs/Web/API/Request/credentials

- Cloudflare Workers routing  
  https://developers.cloudflare.com/workers/configuration/routing/

- Cloudflare Workers Fetch API  
  https://developers.cloudflare.com/workers/runtime-apis/fetch/

- Vercel Functions  
  https://vercel.com/docs/functions/

## 16. 다음 액션

이 문서 다음 단계로 가장 자연스러운 일은 아래 순서다.

1. 모노레포 디렉터리 설계 확정
2. `apps/extension` 이동 계획서 작성
3. `apps/web`의 route map과 content map 작성
4. 확장 전용 기능 / 웹 가능 기능 / BFF 필요 기능 분류표 작성
5. custom domain 후보 3개 확정

다음 턴에서 원하시면 바로 이어서 할 수 있다.

1. 실제 모노레포 폴더 구조와 `pnpm-workspace.yaml` 초안 만들기
2. 기능별로 “웹 가능 / 확장 전용 / BFF 필요” 표를 만들어 문서화하기
3. Astro 기준 `apps/web` 초기 설계서까지 더 이어서 쓰기

## 17. 무료 기준 최종 인프라안

아래 3개 안은 “비용을 최대한 아끼면서도” LinKU를 확장 + 웹 + 필요 시 로그인형 앱으로 키워가는 관점에서 정리한 것이다.

## 17.1 안 A: Cloudflare 단일안

### 구조

- `apps/site` 또는 `apps/web-static`
  - 배포: Cloudflare Pages
  - 역할: SEO 랜딩, 가이드, FAQ, 설치 유도, 링크 소개

- `apps/app`
  - 배포: Cloudflare Workers + Pages/Next on Workers
  - 역할: 실사용 웹앱, Google 로그인, 사용자 기능

- `apps/bff`
  - 배포: Cloudflare Workers로 흡수하거나 `apps/app` 내부 route로 통합

- `apps/extension`
  - 배포: Chrome Web Store

### 장점

1. 무료 총량이 가장 좋다
2. DNS, CDN, 정적 사이트, 서버리스가 한 벤더 안에 모인다
3. SEO 사이트는 Pages로 아주 잘 맞는다
4. custom domain 연결과 edge 캐싱이 강하다

### 단점

1. Next 실사용 앱은 Vercel보다 배포/런타임 경험이 덜 자연스럽다
2. Workers Free 한도인 `100,000 req/day`, `10ms CPU/request`가 로그인형 앱에는 빠르게 부담이 될 수 있다
3. 디버깅/런타임 제약을 더 신경 써야 한다

### 언제 적합한가

- 진짜로 무료를 가장 우선할 때
- 트래픽이 아직 작을 때
- SEO 사이트 비중이 크고, 로그인형 앱은 초기 단계일 때

### LinKU 적합도

`높음`, 단 “앱이 커지면 곧 유료 전환 또는 아키텍처 재조정 가능성 있음”

## 17.2 안 B: Cloudflare + Vercel 혼합안

### 구조

- `www.linku.xxx`
  - 배포: Cloudflare Pages
  - 역할: SEO 사이트, 랜딩, 가이드, 서비스 소개

- `app.linku.xxx`
  - 배포: Vercel
  - 역할: Next.js 기반 Google 로그인형 실사용 웹앱

- `api.linku.xxx`
  - 배포: 초기엔 Vercel Route Handlers 또는 Server Functions
  - 필요 시 Cloudflare Workers나 별도 BFF로 분리

- `apps/extension`
  - 배포: Chrome Web Store

### 장점

1. SEO와 실사용 앱을 각자 가장 잘하는 플랫폼에 올릴 수 있다
2. 공개 사이트는 Cloudflare 무료 자원 활용
3. Next 로그인형 앱은 Vercel에서 가장 쉽게 운영 가능
4. 단계적으로 옮기기 쉽다

### 단점

1. 플랫폼이 둘이라 운영 복잡도가 올라간다
2. 도메인/쿠키/세션 정책을 더 꼼꼼하게 맞춰야 한다
3. 모니터링과 CI/CD도 2군데 본다

### 언제 적합한가

- 지금 가장 현실적이고 균형 좋은 무료 조합을 원할 때
- SEO와 로그인형 앱 둘 다 중요할 때
- 앱 개발 속도도 놓치고 싶지 않을 때

### LinKU 적합도

`매우 높음`

### 무료 기준 추천도

가장 추천

## 17.3 안 C: Vercel 단일안

### 구조

- `apps/web`
  - 배포: Vercel
  - 역할: Next.js SEO 사이트 + 로그인형 앱 통합

- `apps/extension`
  - 배포: Chrome Web Store

- 필요 시 `apps/web` 내부 route handlers로 BFF 흡수

### 장점

1. Next 개발 경험이 가장 좋다
2. 모노레포 연결과 preview deploy가 매우 편하다
3. 로그인/세션/API/SEO를 한 앱 안에서 관리하기 쉽다
4. 운영자가 이해해야 할 플랫폼 수가 적다

### 단점

1. Hobby 플랜이 공식적으로 `personal, non-commercial` 용도다
2. 무료 총량만 놓고 보면 Cloudflare보다 여유가 적을 수 있다
3. 정적 랜딩 사이트까지 굳이 Vercel에 몰아넣는 것이 비용 최적은 아닐 수 있다

### 언제 적합한가

- 가장 빠르게 Next 실사용 앱을 출시하고 싶을 때
- SEO 사이트와 앱을 하나의 Next 프로젝트로 묶고 싶을 때
- 무료는 시작점일 뿐이고, 추후 유료 전환도 감수할 수 있을 때

### LinKU 적합도

`높음`, 단 “장기 무료 운영”보다 “빠른 개발/출시”에 더 적합

## 17.4 세 안의 비교표

| 항목 | 안 A: Cloudflare 단일 | 안 B: Cloudflare + Vercel | 안 C: Vercel 단일 |
| --- | --- | --- | --- |
| 무료 효율 | 가장 높음 | 높음 | 보통 |
| Next 로그인형 앱 개발 편의 | 보통 | 가장 좋음 | 매우 좋음 |
| SEO 사이트 운영 편의 | 매우 좋음 | 매우 좋음 | 좋음 |
| 모노레포 운영 편의 | 좋음 | 보통 | 매우 좋음 |
| 장기 확장성 | 좋음 | 매우 좋음 | 좋음 |
| BFF 확장성 | 좋음 | 매우 좋음 | 좋음 |
| 운영 복잡도 | 낮음 | 가장 높음 | 가장 낮음 |
| 무료 장기 지속 가능성 | 높음 | 보통 이상 | 보통 |
| LinKU 현재 조건 적합도 | 높음 | 매우 높음 | 높음 |

## 17.5 최종 추천

### 1순위: 안 B, Cloudflare + Vercel 혼합안

가장 추천하는 이유는 다음과 같다.

1. 무료 기준으로도 꽤 현실적이다
2. SEO 사이트는 Cloudflare Pages가 잘 받쳐준다
3. Next 로그인형 앱은 Vercel이 가장 자연스럽다
4. LinKU가 “확장 + 공개 SEO 사이트 + 실사용 로그인 앱”을 모두 가져가기에 가장 균형이 좋다

추천 도메인 구조 예시:

- `www.linku.xxx`: Cloudflare Pages
- `app.linku.xxx`: Vercel
- `api.linku.xxx`: 초기엔 app 내부, 커지면 별도

### 2순위: 안 C, Vercel 단일안

이 안은 개발 속도가 중요할 때 가장 좋다.

추천 상황:

- 혼자 빠르게 만들고 싶다
- Next를 메인으로 갈 확신이 있다
- 무료는 시작용이고 이후 유료 가능성이 있다

### 3순위: 안 A, Cloudflare 단일안

이 안은 “무조건 무료 효율 우선”일 때 좋다.

다만 Next 로그인형 앱이 커질수록 Workers Free 제약이 먼저 걸릴 수 있으므로, 장기적으로는 앱 쪽 재배치 가능성을 열어둬야 한다.

## 17.6 지금 바로 고르라면

LinKU의 현재 조건을 모두 반영하면, 지금 바로 고를 추천안은 이것이다.

1. `SEO 사이트`: Cloudflare Pages
2. `Google 로그인형 Next 앱`: Vercel
3. `확장`: Chrome Web Store 유지
4. `BFF`: 초반엔 Next 내부 route handlers, 커지면 분리

즉, 무료 기준의 현실적인 정답은 `혼합안`이다.
