# LinKU Master Implementation Spec

상태: authoritative draft  
작성일: 2026-03-14  
적용 워크트리: `D:\_hobby\coding\LinKU-monorepo-seo`

이 문서는 LinKU의 단일 정본 구현 스펙이다. 아래 두 문서의 내용을 통합하고, 현재 최종 결정 사항인 `Next.js + Chrome Extension + Cloudflare + Vercel` 방향으로 재정리한다.

- `docs/monorepo-extension-web-seo-plan.md`
- `docs/hybrid-infra-monorepo-implementation-plan.md`

앞으로 구현, 검증, 배포, 프롬프트 작성은 이 문서를 기준으로 한다.

## 1. 최종 결정

### 1.1 제품 구성

LinKU는 배포 가능한 앱 기준으로는 2개 앱, 사용자 경험 기준으로는 3개 제품면을 가진다.

배포 가능한 앱:

1. `apps/extension`
2. `apps/web`

사용자 경험 기준 제품면:

1. `Chrome extension`
   - 빠른 진입, 브라우저 privileged API, 현재 탭 제어, 스크립트 주입, 학교 사이트 보조 기능 담당
2. `SEO public web surface`
   - 검색 유입, 설치 전환, 기능 소개, 가이드, FAQ, 업데이트, 학교 서비스 랜딩 페이지 담당
3. `Authenticated web surface`
   - 로그인, 사용자 설정, 즐겨찾기, 확장 연결, 이후 개인화 기능 담당

### 1.2 프레임워크 및 배포 방향

최종 방향은 아래로 확정한다.

- 웹: `Next.js`
- 확장 프로그램: `React + Vite + TypeScript`
- DNS/도메인/프록시/보안 앞단: `Cloudflare`
- 웹 배포: `Vercel`
- 확장 배포: `Chrome Web Store`

즉, 기존 문서에 있던 `Astro + GitHub Pages`는 이번 정본 스펙의 기본안이 아니다. SEO는 Next.js의 정적/서버 하이브리드 기능으로 해결하고, 공개 웹과 로그인 영역도 하나의 Next.js 앱 안에서 운영한다. Cloudflare는 배포 대상이 아니라 도메인 및 엣지 인프라 계층으로 쓴다.

### 1.3 도메인 구조

권장 구조는 아래와 같다.

```text
linku.xxx         -> https://www.linku.xxx 로 301 redirect
www.linku.xxx     -> apps/web 의 단일 canonical 웹 도메인
api.linku.xxx     -> 필요 시 분리 가능한 BFF/API
```

초기 단계에서는 `www.linku.xxx` 하나의 도메인 안에서 공개 SEO surface와 인증 surface를 모두 운영한다. 로그인도 같은 도메인 아래의 `/login`, `/dashboard`, `/settings` 같은 라우트에서 처리한다. `api.linku.xxx`도 별도 서비스로 두지 않고 `apps/web` 내부 Route Handlers로 시작한다. 이후 분리 필요성이 생기면 독립 BFF로 승격한다.

## 2. 목표와 비목표

### 2.1 목표

1. 기존 Chrome extension 기능을 유지한 채 모노레포로 이전한다.
2. 검색 유입이 가능한 공개 웹을 만든다.
3. Google 로그인 기반의 실사용 웹 surface 기반을 만든다.
4. 웹/확장의 공통 UI, 데이터, 타입, 플랫폼 경계를 재정의한다.
5. 배포 파이프라인과 환경 변수 구조를 앱 단위로 정리한다.
6. 구현을 중간 산출물이 아니라 실제 작동하는 구조까지 끌고 간다.

### 2.2 비목표

이번 스펙의 1차 범위에 아래 항목은 포함하지 않는다.

1. 학교 외부 서비스 전체를 서버측으로 완전 통합하는 것
2. 모든 확장 기능을 웹앱으로 동일하게 재현하는 것
3. 모바일 앱 제작
4. 관리자 백오피스 구축
5. 대규모 BFF/마이크로서비스 선구축

## 3. 현재 상태 기준선

현재 레포는 사실상 확장 프로그램 중심 단일 앱이다.

- 루트 `package.json` 기준 현재 메인 스택은 `React 19 + Vite + TypeScript + Tailwind`
- 현재 UI는 popup 중심이며 메인 화면은 사실상 `500x600` 고정 사용성이 기준이다
- 일부 기능은 `chrome.tabs`, `chrome.scripting`, `chrome.storage`, `host_permissions`, 외부 도메인 요청 등 확장 권한에 의존한다
- `gh-pages`는 배너/정적 자산 제공 역할이 강했다
- `eCampus` 계열 로직은 일반 웹앱보다 확장 컨텍스트에 더 기대고 있다

이 기준선은 중요하다. 단일 Next.js 웹앱 안에 공개 surface와 로그인 surface를 추가하더라도, 기존 확장 프로그램의 빠른 사용성은 유지해야 한다.

## 4. 제품 아키텍처

### 4.1 책임 분리 원칙

#### `apps/web`의 공개 surface가 담당하는 것

- 검색 유입용 랜딩 페이지
- 설치 유도 페이지
- 기능 소개
- FAQ
- 학교 서비스/학생 서비스 소개 및 가이드
- 업데이트/릴리즈 노트
- 검색 의도 기반 문서형 페이지

#### `apps/web`의 인증 surface가 담당하는 것

- Google 로그인
- 사용자 프로필/설정
- 즐겨찾기, 링크 개인화, 향후 TODO 동기화 기반
- 확장 연결 상태 확인
- 사용자별 데이터 저장 및 API 접근

#### 확장 프로그램이 담당하는 것

- 현재 탭 조작
- 스크립트 주입
- 브라우저 저장소 직접 사용
- 브라우저 privileged API 의존 기능
- 학교 사이트 보조 기능 중 웹으로 옮기기 어려운 부분

### 4.2 기능 경계 원칙

기능은 아래 4개로 분류한다.

1. 공개 웹에서 가능한 기능
   - 설치 유도
   - 서비스 설명
   - 읽을거리/가이드/FAQ
   - 검색 유입 페이지
2. 인증된 웹 surface에서 가능한 기능
   - 계정
   - 개인 설정
   - 즐겨찾기/개인화
   - 확장 연결 기반 상태 관리
3. 확장에서만 가능한 기능
   - 현재 탭 URL 변경
   - 브라우저 탭/스크립트 제어
   - host permission 기반 요청
   - 브라우저 저장소/권한 API 직접 사용
4. 추후 BFF가 필요한 기능
   - 외부 세션/쿠키/CORS 문제를 동반하는 서버 중계
   - 학교 사이트 연동 중 브라우저만으로 안정적으로 처리되지 않는 흐름
   - 보호된 API 통합 및 캐싱

## 5. 모노레포 최종 구조

### 5.1 폴더 구조

```text
LinKU/
  apps/
    extension/
    web/
  packages/
    ui/
    core/
    platform/
    seo/
    shared-types/
    config/
  tooling/
    eslint/
    typescript/
  scripts/
  public-assets/
  docs/
  pnpm-workspace.yaml
  package.json
```

### 5.2 각 앱의 역할

#### `apps/extension`

- 기존 popup 기반 확장 앱
- Vite 기반 유지
- `manifest.json`, background, popup, content/bridge, chrome adapter 유지
- Chrome Web Store 배포 대상

#### `apps/web`

- 단일 Next.js 웹앱
- Next.js App Router
- 공개 SEO surface와 인증 surface를 함께 담당
- 정적 중심 공개 라우트 + 인증/세션 기반 웹 라우트를 함께 포함
- `www.linku.xxx` 단일 도메인 대응
- 초기 Route Handlers 기반 API 포함
- Vercel 배포 대상

### 5.3 각 패키지의 역할

#### `packages/ui`

- 공통 디자인 토큰
- 버튼, 카드, 탭, 시트, 모달
- popup 카드 프레임
- 브랜드 컴포넌트

#### `packages/core`

- 링크 카탈로그
- 서비스 메타데이터
- 배너/카테고리 도메인 모델
- 검증 로직
- 공통 비즈니스 모델

#### `packages/platform`

- extension/web 간 플랫폼 차이 흡수
- storage port
- browser action port
- capability detection
- extension bridge contract helper

#### `packages/seo`

- metadata helper
- canonical helper
- sitemap helper
- robots helper
- JSON-LD helper

#### `packages/shared-types`

- API response 타입
- session/auth 타입
- analytics event 타입
- extension-web message 타입

#### `packages/config`

- tsconfig base
- eslint config
- prettier or formatting policy if added later
- env schema
- shared constants

## 6. 기술 스택 스펙

### 6.1 공통

- Package manager: `pnpm`
- Workspace: `pnpm-workspace.yaml`
- Language: `TypeScript`
- Lint: `ESLint`
- Styling: `Tailwind CSS`
- UI primitives: 현 레포의 Radix 기반 설계 자산 재사용
- Icons: `lucide-react`

### 6.2 `apps/extension`

- Framework: `React + Vite`
- Build target: Chrome extension
- Storage: `chrome.storage`
- Browser integration: `chrome.tabs`, `chrome.scripting`, `chrome.runtime`, 필요 시 `chrome.cookies`
- Analytics: 기존 Google Analytics 흐름 유지 또는 재정의

### 6.3 `apps/web`

- Framework: `Next.js App Router`
- Rendering:
  - 공개 surface는 static first
  - 인증 surface는 server/auth first
- SEO: metadata API, sitemap, robots, JSON-LD, OG images
- Auth:
  - `Auth.js`
  - `Google OAuth`
- API: Route Handlers로 시작
- Content: route-based authored content, 필요 시 MDX 도입 가능
- Runtime shape:
  - 하나의 Next.js 앱 안에서 공개 페이지와 인증 라우트를 함께 관리
  - URL은 단일 도메인에서 path 기반으로 구분
  - 필요 시 route group 기반으로 내부 구조만 분리
- Data store:
  - 1차: 파일/메모리 같은 임시 저장이 아니라 실제 교체 가능한 인터페이스 설계
  - 2차: DB 도입 필요 시 `Postgres + Prisma` 혹은 `Supabase/Postgres` 계열 검토

### 6.4 인프라

- DNS / SSL / proxy / rules: `Cloudflare`
- Web hosting: `Vercel`
- Extension distribution: `Chrome Web Store`
- Git repository automation: `GitHub Actions`

## 7. 라우트 및 화면 스펙

### 7.1 `apps/web` 공개 surface 필수 라우트

```text
/
/install
/features
/features/todo
/features/ecampus
/features/bookmarks
/services
/services/ecampus
/services/konkuk-portal
/services/academic-calendar
/guides
/guides/install-extension
/guides/how-to-use-linku
/faq
/updates
/privacy
```

### 7.2 `apps/web` 메인 페이지 스펙

메인 페이지는 아래 원칙을 따른다.

1. 중앙에 현재 popup과 동일한 사용성을 연상시키는 `500x600` 앱 카드 영역을 둔다.
2. 좌측에는 서비스 설명, 가치 제안, 대표 사용 시나리오를 둔다.
3. 우측에는 설치 CTA, 웹앱 진입 CTA, 인기 기능 바로가기, 가이드 진입점을 둔다.
4. 아래에는 검색 유입용 읽을거리 콘텐츠를 충분히 배치한다.
5. 데스크탑에서 넓게 펼치되, 앱 카드 자체를 데스크탑 앱처럼 재설계하지 않는다.

### 7.3 `apps/web` 인증 surface 필수 라우트

```text
/
/login
/dashboard
/links
/favorites
/settings
/account
/extension/connect
/api/*
```

인증 surface는 `www.linku.xxx` 단일 도메인 아래 path 기반 라우트로 제공한다. 로컬 개발과 프리뷰 환경에서도 같은 Next 앱 내부에서 route group 또는 path 기반으로 함께 검증할 수 있어야 한다.

### 7.4 `apps/web` 인증 surface MVP 기능

1. Google 로그인
2. 기본 세션 유지
3. 대시보드 쉘
4. 즐겨찾기 또는 개인 링크 저장 기본형
5. 사용자 설정 페이지
6. 확장 연결 상태 페이지

## 8. SEO 스펙

### 8.1 필수 항목

1. 모든 공개 라우트에 title/description 정의
2. canonical URL 적용
3. `sitemap.xml` 생성
4. `robots.txt` 제공
5. Open Graph 메타데이터 적용
6. Twitter/X 카드 메타데이터 적용
7. FAQ / Organization / SoftwareApplication JSON-LD 적용
8. 404 페이지 제공
9. `www`와 apex 리다이렉트 정책 정리

### 8.2 콘텐츠 전략

공개 웹은 단순 소개 페이지가 아니라 검색 의도별 착지 페이지 묶음이 되어야 한다.

주요 콘텐츠 축:

1. 건국대학교 ecampus 관련 탐색/가이드
2. 학교 주요 서비스 바로가기 묶음
3. 학생 제작 서비스 소개
4. 확장 설치 및 사용 가이드
5. 변경 내역/업데이트
6. FAQ

### 8.3 SEO 원칙

1. 공개 웹은 읽을 수 있는 문서 구조를 우선한다.
2. 클라이언트 전용 렌더링에 의존하지 않는다.
3. 페이지 간 내부 링크 구조를 명확히 만든다.
4. 확장 설치 CTA는 강하게, 그러나 콘텐츠보다 앞서지 않게 배치한다.
5. `www`를 canonical 기준으로 통일한다.
6. 인증 라우트는 검색 유입 대상이 아니므로 `noindex` 정책을 적용한다.

## 9. 인증 및 세션 스펙

### 9.1 로그인

- 인증 방식: Google OAuth
- 구현 계층: `apps/web`
- 라이브러리: `Auth.js`
- 세션 전략: 서버측 검증 가능한 세션 구조

### 9.2 도메인 정책

- canonical 도메인은 `https://www.linku.xxx` 하나로 통일한다
- 인증/세션도 같은 canonical 도메인에서 관리한다
- 공개 라우트는 인증 없이 접근 가능해야 한다
- 인증 라우트는 서버측 세션 보호와 `noindex`를 기본 원칙으로 한다

### 9.3 보안 기본 원칙

1. 시크릿은 Vercel 환경 변수로 주입
2. 같은 Next 앱 안에서도 공개 surface와 인증 surface의 CSP를 분리 가능하게 설계
3. OAuth callback URL은 canonical 웹 도메인 기준으로 관리

## 10. Extension <-> Web 연동 스펙

### 10.1 1차 목표

1. 공개 웹에서 확장 설치 유도
2. 인증 surface에서 확장 연결 상태 안내
3. 확장에서 웹앱 deep link 진입 지원

### 10.2 2차 목표

1. 확장과 인증 surface 간 handshake 설계
2. 계정 연결 상태 공유
3. 일부 사용자 설정 동기화

### 10.3 연동 원칙

1. 핵심 기능을 확장-웹 통신 자체에 의존시키지 않는다.
2. 연동은 보조 흐름으로 시작한다.
3. 메시지 타입은 `packages/shared-types`에 둔다.
4. 브리지 구현은 `packages/platform`에 둔다.

## 11. BFF/API 스펙

### 11.1 초기 원칙

초기에는 별도 독립 BFF를 만들지 않는다.

- `apps/web` 내부 `app/api/*` Route Handlers로 시작
- 외부 사이트 세션/CORS 문제로 브라우저만으로 불안정한 기능이 늘어나면 분리 검토

### 11.2 분리 조건

아래 3개 중 2개 이상이 만족되면 `api.linku.xxx`를 분리 검토한다.

1. 외부 사이트 중계가 반복적으로 필요하다
2. 확장과 웹이 같은 API를 광범위하게 공유한다
3. 캐싱/보안/레이트리밋 요구가 커진다

## 12. 환경 변수 스펙

### 12.1 공통

```text
LINKU_ENV=
```

### 12.2 `apps/web`

```text
NEXT_PUBLIC_SITE_URL=https://www.linku.xxx
NEXT_PUBLIC_EXTENSION_URL=https://chromewebstore.google.com/detail/...
NEXT_PUBLIC_EXTENSION_ID=
AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
```

### 12.3 `apps/extension`

```text
VITE_ENVIRONMENT=
VITE_SITE_URL=https://www.linku.xxx
VITE_WEB_BASE_URL=https://www.linku.xxx
VITE_GA_API_SECRET=
```

## 13. CI/CD 스펙

### 13.1 워크플로 구성

#### Workflow A: Monorepo Validate

- trigger: pull_request, push to main
- scope:
  - install
  - lint
  - typecheck
  - test
  - build affected apps/packages

#### Workflow B: Deploy Web

- trigger:
  - `apps/web`
  - `packages/ui`
  - `packages/core`
  - `packages/seo`
  - `packages/config`
- target: Vercel

#### Workflow C: Deploy Extension Draft

- trigger:
  - `apps/extension`
  - shared package changes
- target: Chrome Web Store draft

### 13.2 Cloudflare 역할

Cloudflare는 아래를 담당한다.

1. DNS
2. SSL/TLS 정책
3. 도메인 리다이렉트
4. 캐시 규칙
5. 보안/WAF/봇 방어 기본 정책

## 14. 구현 단계 스펙

### Phase 1. 모노레포 골격 생성

해야 할 일:

1. `pnpm-workspace.yaml` 추가
2. 루트 `package.json`을 workspace orchestrator로 재정리
3. `apps/extension` 폴더 생성
4. 기존 소스 이동 전략 확정
5. 공통 tsconfig/eslint 설정 추출

완료 조건:

- workspace가 설치/빌드 가능한 상태
- 기존 확장 빌드가 깨지지 않음

### Phase 2. 확장 분리 및 안정화

해야 할 일:

1. 기존 `src`, `public`, `scripts`를 `apps/extension`로 이전
2. 빌드/개발 스크립트 갱신
3. manifest 및 자산 경로 재정리
4. 기존 기능 회귀 테스트

완료 조건:

- 기존 확장이 동일하게 빌드됨
- popup 기본 기능과 주요 플로우가 유지됨

### Phase 3. 공통 패키지 추출

해야 할 일:

1. 디자인 토큰 추출
2. 공통 카드/버튼/탭 UI 추출
3. 링크/카테고리/배너 데이터 모델 추출
4. 플랫폼 추상화 인터페이스 작성

완료 조건:

- extension이 `packages/*`를 소비함
- 공통 모델이 한 군데로 정리됨

### Phase 4. `apps/web` 공개 surface 구축

해야 할 일:

1. Next.js 앱 생성
2. 메인 랜딩 페이지 구현
3. install/features/services/guides/faq/updates 라우트 구현
4. metadata, sitemap, robots, canonical, JSON-LD 구현
5. CTA 및 내부 링크 구조 설계

완료 조건:

- 공개 사이트가 빌드 및 배포 가능
- 기본 SEO 구조가 반영됨

### Phase 5. `apps/web` 인증 surface 구축

해야 할 일:

1. 같은 Next.js 앱 내부에 인증 surface 추가
2. Auth.js 기반 Google 로그인 구현
3. dashboard/settings/favorites 기본 라우트 구현
4. Route Handlers 기반 API 쉘 구현
5. 확장 연결 안내 화면 구현

완료 조건:

- 로그인 가능한 인증 surface가 동작
- 세션과 인증 라우트 구조가 안정화됨

### Phase 6. 연동 및 운영 기반 정리

해야 할 일:

1. extension -> web deep link 정리
2. 메시지 타입/연결 지점 정리
3. 환경 변수 문서화
4. GitHub Actions 정리
5. Cloudflare/Vercel 배포 문서화

완료 조건:

- 각 앱의 배포/실행 경로가 문서화됨
- 최소 운영 가능한 수준의 자동화가 준비됨

## 15. 검증 스펙

### 15.1 필수 검증

1. `pnpm install`
2. lint
3. typecheck
4. affected build
5. 확장 빌드 검증
6. 공개 웹 주요 라우트 렌더링 검증
7. 인증 surface 주요 라우트 렌더링 검증

### 15.2 브라우저 검증

Playwright MCP로 아래를 검증한다.

1. 공개 메인 페이지 렌더링
2. install CTA 동작
3. guide/faq 페이지 링크
4. 로그인 진입 동선
5. console error 여부
6. 404/잘못된 링크 여부

## 16. 커밋 규칙

구현은 반드시 작은 단위 커밋으로 진행한다.

권장 메시지 예시:

- `chore: initialize pnpm workspace for monorepo`
- `refactor: move existing extension into apps/extension`
- `feat: extract shared ui and core packages`
- `feat: scaffold next-based public web`
- `feat: add authenticated routes to next web app`
- `ci: add monorepo validation workflows`

원칙:

1. 커밋 하나는 하나의 논리적 변화만 담는다
2. 커밋 전에 변경 범위 검증을 먼저 한다
3. 깨진 상태를 커밋하지 않는다

## 17. Done 정의

이 스펙의 1차 완료 기준은 아래와 같다.

1. 모노레포 구조가 실제로 동작한다
2. `apps/extension`이 정상 빌드된다
3. `apps/web`가 SEO 공개 surface로 동작한다
4. `apps/web`가 로그인형 인증 surface의 기본 기능을 제공한다
5. 공통 패키지가 실제로 재사용된다
6. Cloudflare + Vercel + Chrome Web Store 기준 운영 문서가 존재한다
7. CI/CD 초안이 존재한다
8. 핵심 브라우저 검증이 통과한다

## 18. 구현 시 의사결정 우선순위

구현 중 충돌이 발생하면 아래 순서대로 판단한다.

1. 기존 확장 기능 유지
2. 명확한 경계 분리
3. SEO 구조 품질
4. 운영 단순성
5. 장기 확장성

## 19. 후속 문서

이 정본 스펙 다음 단계에서 필요할 문서는 아래다.

1. migration checklist
2. package dependency map
3. extension/web capability matrix
4. deployment runbook
5. one-shot execution prompt

그러나 구현 착수 전까지는 이 문서 하나만 기준으로 삼는다.
