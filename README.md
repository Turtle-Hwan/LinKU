# LinKU Monorepo

`docs/IMPLEMENTATION_SPEC.md` is the single source of truth for this workspace.

## Structure

```text
apps/
  extension/   Chrome extension built with React + Vite
  web/         Next.js app for the public SEO surface and authenticated routes
packages/
  config/      Shared constants and env readers
  core/        Route content, catalog data, and product copy
  platform/    Shared link helpers and extension/web bridge helpers
  seo/         Metadata, sitemap, robots, and JSON-LD helpers
  shared-types/ Shared API, auth, analytics, and bridge types
  ui/          Shared UI primitives used across apps
tooling/
  eslint/      Shared ESLint base config
  typescript/  Shared TypeScript base config
```

## Apps and packages

- `apps/extension` keeps the browser-privileged workflows: popup UX, tab control, script injection, storage, and extension-only helpers.
- `apps/web` runs on the single canonical domain and serves both the public SEO pages and the authenticated routes such as `/login`, `/dashboard`, `/favorites`, `/settings`, and `/extension/connect`.
- `packages/core`, `packages/seo`, `packages/config`, `packages/platform`, `packages/shared-types`, and `packages/ui` are all consumed by the app layer.

## Local development

```bash
pnpm install

# extension
pnpm dev:extension
pnpm build:extension:local

# web
pnpm dev:web
pnpm build:web

# workspace validation
pnpm lint
pnpm typecheck
pnpm validate
```

`pnpm build` runs the public/authenticated web build plus a non-version-bumping extension build.

## Environment variables

### Common

```text
LINKU_ENV=
```

### `apps/web`

```text
NEXT_PUBLIC_SITE_URL=https://www.linku.xxx
NEXT_PUBLIC_EXTENSION_URL=https://chromewebstore.google.com/detail/replace-with-extension-id
NEXT_PUBLIC_EXTENSION_ID=replace-with-extension-id
AUTH_SECRET=replace_with_auth_secret
AUTH_GOOGLE_ID=replace_with_google_client_id
AUTH_GOOGLE_SECRET=replace_with_google_client_secret
```

### `apps/extension`

```text
VITE_ENVIRONMENT=development
VITE_SITE_URL=https://www.linku.xxx
VITE_WEB_BASE_URL=https://www.linku.xxx
VITE_GA_API_SECRET=replace_with_ga_api_secret
VITE_API_BASE_URL=https://api-placeholder.linku.xxx/api
```

`VITE_API_BASE_URL` remains for the current legacy extension auth/template flows and is the main optional external dependency still outside this monorepo.

## Deployment model

- Cloudflare handles DNS, SSL/TLS, apex-to-www redirect, cache rules, and baseline WAF/bot policy.
- Vercel hosts `apps/web`.
- Chrome Web Store distributes `apps/extension`.
- GitHub Actions runs workspace validation plus deploy-oriented workflows for web and extension draft uploads.

## Remaining external dependencies

- Real Google OAuth credentials for `apps/web`
- Real Vercel project/org/token secrets for automated deploys
- Real Chrome Web Store OAuth client + refresh token secrets for draft uploads
- Optional backend API endpoint used by the current extension member/template flows
