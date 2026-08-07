# Deployment and External Integration Runbook

이 문서는 LinKU 모노레포를 실제 운영 환경에 연결할 때 필요한 순서와 검증
항목을 기록합니다. 저장소의 `linku.xxx`, `replace-with-extension-id`,
`api-placeholder` 값은 의도적인 placeholder입니다. 실제 값을 확인하기 전에는
추측해서 바꾸지 마세요.

## 1. 현재 자동화

| Workflow | Trigger | 결과 |
| --- | --- | --- |
| `monorepo-validate.yml` | PR, `main` push | install, lint, typecheck, web/extension build |
| `deploy-web.yml` | web/shared 경로의 `main` push | Vercel production deploy |
| `deploy-extension-draft.yml` | extension/shared 경로의 `main` push 또는 manual | patch version bump, CWS draft upload, version commit, matching GitHub Release |

배포 secret이 없으면 deploy workflow는 외부 변경을 건너뜁니다. Draft upload와
GitHub Release는 같은 extension archive와 manifest version을 사용하도록 한
workflow 안에서 직렬 실행됩니다.

## 2. GitHub Actions secrets

Repository Settings → Secrets and variables → Actions에 등록합니다.

### Web / Vercel

| Secret | 설명 |
| --- | --- |
| `VERCEL_TOKEN` | production deploy 권한이 있는 Vercel token |
| `VERCEL_ORG_ID` | LinKU Vercel team/account ID |
| `VERCEL_PROJECT_ID_WEB` | `apps/web` Vercel project ID |

### Extension / Chrome Web Store

| Secret | 설명 |
| --- | --- |
| `CHROME_EXTENSION_ID` | 기존 LinKU Chrome Web Store item ID |
| `CHROME_CLIENT_ID` | Chrome Web Store API OAuth client ID |
| `CHROME_CLIENT_SECRET` | Chrome Web Store API OAuth client secret |
| `CHROME_REFRESH_TOKEN` | draft upload 권한 refresh token |
| `VITE_API_BASE_URL` | extension legacy backend API base |
| `VITE_GA_API_SECRET` | 기존 extension analytics 설정 |

Repository Actions variable도 등록합니다.

| Variable | 설명 |
| --- | --- |
| `LINKU_SITE_URL` | 실제 canonical web URL. Extension의 site/web base로 빌드됨 |

`GITHUB_TOKEN`에는 `contents: write`가 필요합니다. Repository의 Actions workflow
permission과 protected branch 설정이 version bump commit을 허용하는지
확인하세요. Direct push가 금지된 경우 version bump 방식을 별도 release PR로
바꿔야 합니다.

## 3. Vercel project

1. 저장소를 Vercel에 연결합니다.
2. Root Directory를 `apps/web`로 지정합니다.
3. Framework Preset은 Next.js를 사용합니다.
4. Node.js 24와 pnpm을 사용하도록 project 설정을 확인합니다.
5. Production environment variables를 등록합니다.

필수 또는 운영 권장 환경 변수:

| Variable | 범위 | 설명 |
| --- | --- | --- |
| `AUTH_SECRET` | server secret | Auth.js signing secret |
| `AUTH_GOOGLE_ID` | server secret | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | server secret | Google OAuth client secret |
| `NEXT_PUBLIC_SITE_URL` | public | `https://www.<actual-domain>` |
| `NEXT_PUBLIC_EXTENSION_URL` | public | 실제 Chrome Web Store listing |
| `NEXT_PUBLIC_EXTENSION_ID` | public | 실제 extension ID |
| `LINKU_API_BASE_URL` | server | 기존 LinKU backend `/api` base |

Preview와 Production에 서로 다른 OAuth callback/domain이 필요하면 Google Cloud
console에 각 redirect URI를 명시적으로 추가합니다. Production callback은
다음 형태입니다.

```text
https://www.<actual-domain>/api/auth/callback/google
```

Legacy LinKU backend OAuth callback은 구현된 route 기준으로 별도 등록합니다.

```text
https://www.<actual-domain>/api/linku-auth/callback
```

## 4. Google OAuth

1. Google Cloud project와 OAuth consent screen을 확인합니다.
2. Production domain을 authorized domain에 등록합니다.
3. Web application client를 만들고 Vercel의 ID/secret에 연결합니다.
4. Authorized JavaScript origin과 redirect URI를 정확한 canonical domain으로
   제한합니다.
5. Test user 제한, app verification, publishing status를 확인합니다.

검증:

- `/login`에서 Google provider가 노출되는지
- callback 후 localized protected route로 돌아오는지
- session cookie가 production에서 `Secure`로 설정되는지
- logout 후 protected route가 다시 login으로 이동하는지
- open redirect가 허용되지 않는지

## 5. Cloudflare

Cloudflare는 Vercel 앞단의 DNS/edge 계층입니다.

1. 실제 domain zone을 Cloudflare에 등록합니다.
2. Vercel이 제공한 apex와 `www` DNS target을 설정합니다.
3. canonical host를 `www`로 정했다면 apex → `www` 301 redirect를 만듭니다.
4. SSL/TLS는 Vercel 인증서와 호환되는 `Full (strict)`를 사용합니다.
5. `/api/auth/*`, `/api/linku-auth/*`, protected page, session response는
   cache하지 않습니다.
6. 정적 asset과 공개 SEO page만 검토 후 cache rule을 적용합니다.
7. WAF/bot rule이 OAuth callback, sitemap, robots, legitimate crawler를 막지
   않는지 확인합니다.

DNS가 안정된 뒤 `NEXT_PUBLIC_SITE_URL`, Google callback, sitemap canonical을
동일한 host로 맞춥니다.

## 6. Chrome Web Store

1. 기존 CWS item의 extension ID를 확인합니다.
2. Web Store API project와 OAuth client를 설정합니다.
3. Draft upload 권한 refresh token을 발급합니다.
4. GitHub secrets에 ID/client/secret/token을 등록합니다.
5. `VITE_SITE_URL`, `VITE_WEB_BASE_URL`, backend/analytics 값을 workflow의 실제
   production 값으로 교체합니다.
6. `Deploy Extension Draft`를 `main`에서 수동 실행해 첫 연결을 검증합니다.

Workflow는 build 전에 manifest patch version을 올리고 draft upload 성공 후
그 변경을 `main`에 커밋합니다. 이어서 같은 zip으로 GitHub Release를 만듭니다.
Chrome Web Store publication은 자동화하지 않으며 draft review 후 사람이
승인합니다.

배포 전 수동 검증:

- `pnpm build:extension:local`
- `apps/extension/dist/` unpacked load
- popup, tabs, links, todo, alerts, Labs
- template create/edit/save/apply/gallery
- storage와 기존 사용자 migration
- badge와 background service worker
- Google OAuth와 silent reauth
- web deep link와 실제 extension ID
- Chrome Web Store permission disclosure

## 7. Legacy backend

Web과 extension이 같은 backend contract를 사용하도록 실제
`LINKU_API_BASE_URL`/`VITE_API_BASE_URL`을 확인합니다.

검증해야 할 contract:

- Google/guest/member auth와 refresh
- email verification
- template owned/cloned/public/like/post
- alerts와 subscription
- icon/default asset
- API response envelope와 error code
- CORS, extension origin, canonical web origin allowlist

Token이나 credential을 브라우저 console, GitHub log, Vercel build log에
출력하지 않습니다.

## 8. Production smoke test

### Web

- `/`, `/en`, locale switch
- install CTA와 CWS listing
- feature/service/guide/FAQ detail
- sitemap, robots, Open Graph image, canonical/hreflang
- login, callback, logout, protected route
- account/settings/favorites/links/todo/alerts/Labs/template flows
- 404와 broken internal link
- desktop/mobile, console error, failed request

### Extension

- 현재 Web Store package 설치/update
- popup 기본/편집 flow
- external school site integration
- web login/deep link handoff
- service worker 재시작 후 storage와 auth 복구

## 9. Rollback

- Web: Vercel의 직전 정상 production deployment를 promote/rollback하고
  Cloudflare cache를 필요한 범위에서만 purge합니다.
- Extension: 문제가 있는 draft는 publish하지 않습니다. 이미 publish했다면
  수정 버전을 더 높은 manifest version으로 다시 제출해야 합니다.
- OAuth/backend: credential rotation이 필요하면 GitHub/Vercel secret을 함께
  갱신하고 기존 token 폐기 범위를 확인합니다.

Rollback 후 장애 원인, 영향 route/version, 복구 deployment/version, 후속
검증을 기록합니다.

## 10. 운영 연결 완료 체크리스트

- [ ] 실제 canonical domain 확정
- [ ] Cloudflare DNS/TLS/redirect/cache/WAF 설정
- [ ] Vercel project/org/token 연결
- [ ] Vercel production environment variables 등록
- [ ] Google OAuth consent/client/callback 연결
- [ ] Chrome Web Store ID와 upload credential 연결
- [ ] Legacy backend URL/CORS/OAuth contract 확인
- [ ] Unpacked extension 회귀 검증
- [ ] Production web 브라우저 회귀 검증
- [ ] CWS draft 수동 검토
- [ ] 배포/rollback 담당자와 절차 확인
