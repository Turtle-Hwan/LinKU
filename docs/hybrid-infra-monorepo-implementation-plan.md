# LinKU 혼합 인프라 모노레포 실행 계획

> Archived plan. `docs/IMPLEMENTATION_SPEC.md` is the only authoritative spec.
> This file may still describe the removed `apps/app` and subdomain split approach.

작성일: 2026-03-14  
기준안: `Cloudflare Pages + Vercel + Chrome Web Store` 혼합안  
목표: SEO 사이트, Google 로그인형 웹앱, 크롬 확장을 하나의 모노레포에서 관리하고 배포하는 실행 구조 정의

## 1. 목표 요약

이번 문서는 이전 계획 문서의 추천안 중 아래 구조를 실제로 구현하기 위한 실행용 스펙이다.

- `www.linku.xxx`: SEO 공개 사이트
- `app.linku.xxx`: Next.js 기반 실사용 로그인형 웹앱
- `api.linku.xxx`: 초기에는 `app` 내부 API, 이후 필요 시 분리
- `extension`: Chrome Web Store 배포

배포 플랫폼은 다음처럼 가져간다.

- 공개 SEO 사이트: Cloudflare Pages
- 로그인형 앱: Vercel
- 확장 프로그램: Chrome Web Store
- DNS: 가능하면 Cloudflare

## 2. 도메인 구조

## 2.1 권장 도메인 구성

```text
www.linku.xxx   -> 공개 SEO 사이트
app.linku.xxx   -> 로그인형 웹앱
api.linku.xxx   -> 추후 분리 가능한 API/BFF
linku.xxx       -> www로 301 redirect
```

### 이유

`www`와 `app`을 분리하면 다음이 좋아진다.

1. SEO 사이트와 앱의 책임이 분리된다
2. cookie / auth / CSP / analytics 설정이 깔끔해진다
3. 웹앱이 커져도 SEO 구조가 덜 흔들린다
4. 나중에 `api`를 분리할 때도 자연스럽다

## 2.2 추천 canonical 정책

- `https://www.linku.xxx/`를 공개 사이트 canonical로 사용
- `https://linku.xxx/`는 항상 `www`로 리다이렉트
- 앱 라우트는 `https://app.linku.xxx/` 기준으로 별도 canonical

즉, `www`와 `app`은 같은 사이트가 아니라 목적이 다른 두 서비스처럼 다뤄야 한다.

## 3. 모노레포 구조

## 3.1 최종 권장 폴더 구조

```text
LinKU/
  apps/
    extension/
    site/
    app/
  packages/
    ui/
    core/
    platform/
    seo/
    config/
    shared-types/
  tooling/
    eslint/
    typescript/
  scripts/
  docs/
  pnpm-workspace.yaml
  package.json
```

## 3.2 앱별 책임

### `apps/extension`

역할:

- 기존 크롬 확장 popup
- `chrome.tabs`, `chrome.scripting`, `chrome.storage` 사용
- 확장 전용 편의 기능
- 웹과 공유 가능한 UI/데이터 소비

배포:

- Chrome Web Store

### `apps/site`

권장 스택:

- Astro
- 정적 배포 전용

역할:

- 메인 SEO 사이트
- 서비스 소개
- 기능 설명
- 설치 유도
- FAQ
- 학교 서비스/학생 서비스 가이드
- 검색 유입용 문서 페이지

배포:

- Cloudflare Pages

### `apps/app`

권장 스택:

- Next.js App Router

역할:

- Google 로그인형 실사용 웹앱
- 사용자 설정/개인화
- TODO/즐겨찾기/확장 연동
- 앱 전용 API route / route handlers
- 초기 BFF 역할 일부 흡수

배포:

- Vercel

## 3.3 패키지별 책임

### `packages/ui`

- 디자인 토큰
- 버튼 / 카드 / 탭 / 모달
- 로고 / 브랜드 컴포넌트
- 앱 카드 레이아웃 기초

### `packages/core`

- 링크 카탈로그 데이터
- 배너 데이터 모델
- 기능 메타데이터
- 공통 비즈니스 타입
- 공통 validation

### `packages/platform`

- 확장/웹 차이를 흡수하는 adapter
- storage port
- browser action port
- capability detection

### `packages/seo`

- route metadata helper
- JSON-LD 생성
- sitemap helper
- canonical helper

### `packages/shared-types`

- API 응답 타입
- auth/session 타입
- analytics event 타입
- extension-web bridge message 타입

### `packages/config`

- eslint config
- tsconfig base
- shared env schema
- shared constants

## 4. 앱별 상세 설계

## 4.1 `apps/site` 설계

### 핵심 목표

1. 검색 유입 확보
2. 확장 설치 전환
3. 웹앱 유입
4. 학교 서비스 랜딩 페이지 확보

### 핵심 라우트

```text
/
/install
/features
/features/todo
/features/ecampus
/features/bookmarks
/guides
/guides/install-extension
/guides/how-to-use-linku
/services
/services/ecampus
/services/konkuk-portal
/services/academic-calendar
/faq
/updates
```

### 메인 페이지 레이아웃

```text
+-------------------------------------------------------------+
| 좌측 소개 | 중앙 500x600 popup 스타일 카드 | 우측 CTA/설치/가이드 |
+-------------------------------------------------------------+
| 아래: 기능 설명 / 서비스 소개 / FAQ / 업데이트 / 내부 링크     |
+-------------------------------------------------------------+
```

### 구현 원칙

1. 앱 카드 자체는 현재 확장 popup 비율 유지
2. 좌우/하단에 SEO용 읽을거리 보강
3. 페이지별 정적 HTML 최대화
4. CTA는 항상 `Chrome 설치`, `웹앱 열기` 두 갈래 제공

## 4.2 `apps/app` 설계

### 핵심 목표

1. Google 로그인
2. 개인화 상태 저장
3. 실제 사용 가능한 웹앱
4. 확장과 계정/설정/데이터를 연결할 수 있는 기반

### 핵심 라우트 예시

```text
/
/login
/dashboard
/todos
/links
/settings
/account
/extension/connect
/api/*
```

### 인증 권장 방향

- Next.js App Router
- Auth.js
- Google OAuth

### 초기 기능 추천

1. Google 로그인
2. 즐겨찾기 링크 저장
3. 카테고리별 링크 핀
4. 개인 설정 동기화
5. 확장 연결 상태 보기

주의:

`eCampus`처럼 외부 세션/쿠키/CORS에 강하게 묶인 기능은 웹앱 1차 범위에서 무리하게 넣지 않는 것이 좋다.

## 4.3 `apps/extension` 설계

현재 코드베이스를 크게 유지하되 아래 방향으로 구조를 다듬는다.

### 유지할 것

- popup 크기/흐름
- Chrome API 활용 기능
- 빠른 링크 허브 UX

### 바꿀 것

1. 확장 전용 로직을 `packages/platform/chrome` 쪽으로 추출
2. 공유 가능한 UI/데이터는 `packages/*`로 분리
3. 웹앱과 통신 가능한 브리지 설계

## 5. 웹/확장/API 경계

## 5.1 기능 분류 원칙

### 공개 SEO 사이트에서 가능한 것

- 정적 정보
- 링크 큐레이션
- 서비스 안내
- FAQ / 가이드 / 업데이트

### 로그인 웹앱에서 가능한 것

- 계정
- 즐겨찾기
- 개인화
- 자체 저장 데이터
- 확장 연동 상태

### 확장에서만 가능한 것

- 현재 탭 조작
- 탭 스크립트 주입
- 브라우저 privileged APIs
- host permissions 기반 편의 기능

### 추후 API/BFF가 필요한 것

- 외부 사이트 세션 기반 프록시
- 서버 측 캐시/정제
- CORS 우회가 필요한 데이터 연동

## 5.2 초기 API 전략

초반에는 `api.linku.xxx`를 따로 만들지 않고 `apps/app` 내부 Route Handlers로 시작하는 것이 좋다.

예시:

```text
apps/app/app/api/user/preferences/route.ts
apps/app/app/api/favorites/route.ts
apps/app/app/api/extension/handshake/route.ts
```

### 분리 시점

다음 중 2개 이상이면 `api.linku.xxx` 또는 별도 BFF 분리를 검토한다.

1. 외부 서비스 프록시가 늘어남
2. 웹앱과 확장이 같은 API를 대량으로 공유
3. 캐시/보안/레이트리밋 정책이 복잡해짐
4. 서버 작업량이 눈에 띄게 증가

## 6. extension <-> app 연결 계획

## 6.1 목표

- 확장 사용자가 웹앱에 로그인되어 있으면 상태를 연결
- 웹앱이 확장 설치 여부를 감지
- 확장에서 웹앱 deep link 열기

## 6.2 1차 연결 범위

1. 웹앱에서 “확장 설치됨/안 됨” 감지
2. 확장에서 “웹앱 열기” 버튼 제공
3. 웹앱 로그인 후 확장 연결 가이드 제공

## 6.3 2차 연결 범위

1. 웹 ↔ 확장 handshake
2. 계정 연결 상태 공유
3. 웹 설정을 확장에서 동기화

주의:

웹-확장 통신은 보조 경로로만 쓰고, 핵심 기능 전제 조건으로 두지 않는다.

## 7. 환경 변수 설계

## 7.1 루트 공통

```text
NODE_ENV=
LINKU_ENV=
```

## 7.2 `apps/site`

```text
PUBLIC_SITE_URL=https://www.linku.xxx
PUBLIC_APP_URL=https://app.linku.xxx
PUBLIC_EXTENSION_URL=https://chromewebstore.google.com/detail/...
```

## 7.3 `apps/app`

```text
NEXT_PUBLIC_SITE_URL=https://www.linku.xxx
NEXT_PUBLIC_APP_URL=https://app.linku.xxx
NEXT_PUBLIC_EXTENSION_ID=
AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
```

## 7.4 `apps/extension`

```text
VITE_ENVIRONMENT=
VITE_GA_API_SECRET=
VITE_WEB_APP_URL=https://app.linku.xxx
VITE_SITE_URL=https://www.linku.xxx
```

## 8. CI/CD 구조

## 8.1 워크플로우 개요

### Workflow 1: Validate Monorepo

trigger:

- pull_request
- push to `main`

작업:

1. install
2. lint
3. typecheck
4. test
5. package dependency graph 확인

### Workflow 2: Deploy Site

trigger:

- `apps/site`
- `packages/ui`
- `packages/core`
- `packages/seo`
- `packages/config`

배포 대상:

- Cloudflare Pages

### Workflow 3: Deploy App

trigger:

- `apps/app`
- 공유 패키지 변경

배포 대상:

- Vercel

### Workflow 4: Deploy Extension Draft

trigger:

- `apps/extension`
- 공유 패키지 변경

배포 대상:

- Chrome Web Store Draft

## 8.2 브랜치 전략

권장:

- `main`: 배포 기준
- PR: preview 환경

### Preview 환경

- `apps/site`: Cloudflare preview
- `apps/app`: Vercel preview

## 9. 단계별 마이그레이션 순서

## 9.1 Phase 1: 모노레포 뼈대 생성

1. `pnpm-workspace.yaml` 추가
2. `apps/extension` 폴더 생성
3. 현재 코드 이동
4. 빌드 경로 정상화

성공 조건:

- 확장 빌드가 기존과 동일하게 성공

## 9.2 Phase 2: 공유 패키지 추출

1. UI 공통 컴포넌트 추출
2. 링크 데이터 추출
3. 브랜드 토큰 추출
4. 브라우저/스토리지 adapter 분리

성공 조건:

- 확장 앱이 공유 패키지를 소비

## 9.3 Phase 3: `apps/site` 생성

1. Astro 앱 생성
2. 메인 페이지 구현
3. SEO route 기본 세팅
4. Cloudflare Pages 연결

성공 조건:

- `www` 사이트가 공개 가능

## 9.4 Phase 4: `apps/app` 생성

1. Next 앱 생성
2. Auth.js + Google 로그인
3. dashboard/settings/favorites 초안
4. Vercel 연결

성공 조건:

- 로그인 가능한 웹앱 MVP

## 9.5 Phase 5: 확장-웹 연결

1. 확장에서 웹앱 deep link 추가
2. 웹앱에서 확장 설치 가이드 추가
3. 필요 시 handshake 초안 구현

## 9.6 Phase 6: API/BFF 판단

1. 웹에서 필요한 외부 데이터 흐름 재분석
2. `api` 분리 필요 여부 결정
3. 분리 시 `api.linku.xxx` 도입

## 10. 초기 구현 우선순위

지금 바로 착수할 때 우선순위는 아래가 가장 좋다.

1. `apps/extension` 분리
2. `packages/ui`, `packages/core` 추출
3. `apps/site` 메인 랜딩 제작
4. `apps/app` 로그인 MVP 제작
5. 도메인 연결
6. CI/CD 연결

## 11. 리스크와 대응

## 11.1 리스크: 공유 패키지 추출이 과해질 수 있음

대응:

- 처음부터 모든 것을 공유하려 하지 않는다
- UI, 링크 데이터, 타입부터 시작

## 11.2 리스크: `site`와 `app`의 역할이 섞일 수 있음

대응:

- `site`는 SEO/콘텐츠
- `app`은 로그인형 제품
- 책임 분리 원칙 유지

## 11.3 리스크: 확장 전용 로직이 공유 패키지로 새어 들어감

대응:

- `chrome.*` 직접 호출은 `apps/extension` 또는 `packages/platform/chrome` 내부로 제한

## 11.4 리스크: 도메인/쿠키 정책 꼬임

대응:

- 처음부터 `www`, `app`, `api` 서브도메인 분리
- auth cookie 전략을 앱 기준으로 정리

## 12. 지금 시점의 최종 실행 추천

이번 구조에서 가장 먼저 해야 할 현실적인 액션은 이것이다.

1. 모노레포로 폴더를 분리한다
2. 확장 앱이 깨지지 않게 먼저 고정한다
3. SEO 사이트를 Astro로 붙인다
4. 로그인형 앱을 Next로 붙인다
5. 그 다음에야 API/BFF를 논한다

즉, “확장 유지 + SEO 확보 + 로그인형 앱 시작”을 동시에 하려면, 처음부터 모든 문제를 서버로 풀려고 하기보다 제품 표면을 먼저 나누는 것이 중요하다.

## 13. 다음 문서 후보

이 문서 다음으로 만들면 좋은 것은 아래 둘이다.

1. 기능별 분류표  
   `웹 가능 / 앱 가능 / 확장 전용 / BFF 필요`

2. 실제 생성용 체크리스트  
   `pnpm-workspace.yaml`, package name, build script, env 파일명, CI secret 목록
