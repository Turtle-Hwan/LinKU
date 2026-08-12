import type {
  AuthProfile,
  AuthSessionResponse,
  CloudShareRecord,
  SyncIndexEntry,
  SyncIndexResponse,
  SyncedTemplateDocumentV1,
} from "../src/types/serverless";
import { validateTemplateSharePayload } from "../src/utils/templateShareCodec";
import { randomToken, sha256, timingSafeEqual } from "./crypto";
import { verifyGoogleIdToken } from "./googleIdentity";
import { fail, ok, readJsonBody } from "./http";

interface Env {
  LINKU_DATA: R2Bucket;
  AUTH_RATE_LIMITER: RateLimit;
  PUBLIC_RATE_LIMITER: RateLimit;
  USER_RATE_LIMITER: RateLimit;
  API_ORIGIN: string;
  WEB_ORIGIN: string;
  SHARE_PAGE_URL: string;
  EXTENSION_ID: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
}

interface OAuthState {
  redirectUri: string;
  clientState: string;
  codeChallenge: string;
  nonce: string;
  expiresAt: number;
}

interface OAuthExchange {
  accountId: string;
  profile: AuthProfile;
  codeChallenge: string;
  expiresAt: number;
}

interface SessionRecord {
  accountId: string;
  sessionId: string;
  accessHash: string;
  accessExpiresAt: number;
  refreshHash: string;
  refreshExpiresAt: number;
  profile: AuthProfile;
  updatedAt: string;
}

interface AccessClaims {
  accountId: string;
  sessionId: string;
}

type SessionTokenKind = "a" | "r";

interface SessionTokenPair {
  accessToken: string;
  accessHash: string;
  accessExpiresAt: number;
  refreshToken: string;
  refreshHash: string;
  refreshExpiresAt: number;
}

const ACCESS_TOKEN_SECONDS = 15 * 60;
const REFRESH_TOKEN_SECONDS = 30 * 24 * 60 * 60;
const EXCHANGE_SECONDS = 5 * 60;
const JSON_LIMIT = 256 * 1024;
const MAX_SESSIONS_PER_ACCOUNT = 5;
const MAX_TEMPLATES_PER_ACCOUNT = 50;
const MAX_CLOUD_SHARES_PER_ACCOUNT = 20;
const SHARE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const TOKEN_PART_PATTERN = /^[A-Za-z0-9_-]{22,128}$/u;

function requestId(): string {
  return crypto.randomUUID();
}

function requestActor(request: Request): string {
  return request.headers.get("cf-connecting-ip") || "local";
}

async function enforceRateLimit(
  limiter: RateLimit,
  key: string,
): Promise<Response | null> {
  const result = await limiter.limit({ key });
  return result.success
    ? null
    : fail(
        requestId(),
        "RATE_LIMITED",
        "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
        429,
        true,
      );
}

function allowedOrigin(request: Request, env: Env): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  if (
    origin === env.WEB_ORIGIN ||
    origin === `chrome-extension://${env.EXTENSION_ID}`
  ) {
    return origin;
  }
  return null;
}

function addResponseHeaders(
  response: Response,
  request: Request,
  env: Env,
): Response {
  const headers = new Headers(response.headers);
  const origin = allowedOrigin(request, env);
  if (origin) {
    headers.set("access-control-allow-origin", origin);
    headers.set(
      "access-control-allow-headers",
      "authorization, content-type, if-match, if-none-match",
    );
    headers.set(
      "access-control-allow-methods",
      "GET, POST, PUT, DELETE, OPTIONS",
    );
    headers.set("access-control-expose-headers", "etag");
    headers.append("vary", "origin");
  }
  if (!headers.has("cache-control")) headers.set("cache-control", "no-store");
  headers.set("referrer-policy", "no-referrer");
  headers.set("x-content-type-options", "nosniff");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isAllowedRedirect(value: string, env: Env): boolean {
  return value === `https://${env.EXTENSION_ID}.chromiumapp.org/`;
}

function googleCallbackUrl(env: Env): string {
  return `${env.API_ORIGIN.replace(/\/$/u, "")}/api/auth/google/callback`;
}

function conditionalHeaders(request: Request): Headers | null {
  const ifMatch = request.headers.get("if-match");
  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifMatch && ifNoneMatch) return null;
  if (!ifMatch && ifNoneMatch !== "*") return null;
  const headers = new Headers();
  if (ifMatch) headers.set("if-match", ifMatch);
  if (ifNoneMatch) headers.set("if-none-match", ifNoneMatch);
  return headers;
}

function validResourceId(value: string): boolean {
  return /^[A-Za-z0-9:_-]{1,128}$/u.test(value);
}

function validateSyncedTemplateDocument(
  value: unknown,
  expectedId: string,
): value is SyncedTemplateDocumentV1 {
  if (!value || typeof value !== "object") return false;
  const document = value as Record<string, unknown>;
  if (
    document.version !== 1 ||
    document.id !== expectedId ||
    typeof document.name !== "string" ||
    typeof document.height !== "number" ||
    typeof document.cloned !== "boolean" ||
    !Array.isArray(document.items) ||
    !Array.isArray(document.stagingItems) ||
    typeof document.createdAt !== "string" ||
    !Number.isFinite(Date.parse(document.createdAt)) ||
    typeof document.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(document.updatedAt))
  ) {
    return false;
  }

  try {
    validateTemplateSharePayload({
      version: 1,
      template: {
        name: document.name,
        height: document.height,
        items: document.items,
      },
    });
    validateTemplateSharePayload({
      version: 1,
      template: {
        name: document.name,
        height: document.height,
        items: document.stagingItems,
      },
    });
    return true;
  } catch {
    return false;
  }
}

function validateCloudShareRecord(value: unknown): value is CloudShareRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (
    record.version !== 1 ||
    typeof record.createdAt !== "string" ||
    !Number.isFinite(Date.parse(record.createdAt)) ||
    typeof record.expiresAt !== "string" ||
    !Number.isFinite(Date.parse(record.expiresAt)) ||
    Date.parse(record.expiresAt) <= Date.parse(record.createdAt) ||
    typeof record.ownerId !== "string" ||
    !TOKEN_PART_PATTERN.test(record.ownerId)
  ) {
    return false;
  }
  try {
    validateTemplateSharePayload(record.payload);
    return true;
  } catch {
    return false;
  }
}

function parseSessionToken(
  token: string,
  expectedKind: SessionTokenKind,
): { accountId: string; sessionId: string; secret: string } | null {
  const [kind, accountId, sessionId, secret, extra] = token.split(".");
  if (
    kind !== expectedKind ||
    !accountId ||
    !sessionId ||
    !secret ||
    extra ||
    !TOKEN_PART_PATTERN.test(accountId) ||
    !TOKEN_PART_PATTERN.test(sessionId) ||
    !TOKEN_PART_PATTERN.test(secret)
  ) {
    return null;
  }
  return { accountId, sessionId, secret };
}

async function issueSessionTokens(
  accountId: string,
  sessionId: string,
  refreshExpiresAt = Math.floor(Date.now() / 1000) + REFRESH_TOKEN_SECONDS,
): Promise<SessionTokenPair> {
  const now = Math.floor(Date.now() / 1000);
  const accessSecret = randomToken(32);
  const refreshSecret = randomToken(32);
  return {
    accessToken: `a.${accountId}.${sessionId}.${accessSecret}`,
    accessHash: await sha256(accessSecret),
    accessExpiresAt: now + ACCESS_TOKEN_SECONDS,
    refreshToken: `r.${accountId}.${sessionId}.${refreshSecret}`,
    refreshHash: await sha256(refreshSecret),
    refreshExpiresAt,
  };
}

async function listAll(env: Env, prefix: string): Promise<R2Object[]> {
  const objects: R2Object[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.LINKU_DATA.list({
      prefix,
      cursor,
      include: ["customMetadata"],
    });
    objects.push(...page.objects);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return objects;
}

async function createSession(
  env: Env,
  accountId: string,
  profile: AuthProfile,
  sessionId: string,
): Promise<AuthSessionResponse> {
  const tokens = await issueSessionTokens(accountId, sessionId);
  const session: SessionRecord = {
    accountId,
    sessionId,
    accessHash: tokens.accessHash,
    accessExpiresAt: tokens.accessExpiresAt,
    refreshHash: tokens.refreshHash,
    refreshExpiresAt: tokens.refreshExpiresAt,
    profile,
    updatedAt: new Date().toISOString(),
  };
  await env.LINKU_DATA.put(
    `auth/sessions/${accountId}/${sessionId}.json`,
    JSON.stringify(session),
    { httpMetadata: { contentType: "application/json" } },
  );

  const sessions = await listAll(env, `auth/sessions/${accountId}/`);
  if (sessions.length > MAX_SESSIONS_PER_ACCOUNT) {
    await env.LINKU_DATA.delete(
      sessions
        .sort((left, right) => right.uploaded.getTime() - left.uploaded.getTime())
        .slice(MAX_SESSIONS_PER_ACCOUNT)
        .map((object) => object.key),
    );
  }

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: new Date(tokens.accessExpiresAt * 1000).toISOString(),
    accountId,
    profile,
  };
}

async function authenticate(
  request: Request,
  env: Env,
): Promise<AccessClaims | null> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = parseSessionToken(authorization.slice(7), "a");
  if (!token) return null;

  const object = await env.LINKU_DATA.get(
    `auth/sessions/${token.accountId}/${token.sessionId}.json`,
  );
  if (!object) return null;
  const session = await object.json<SessionRecord>();
  const now = Math.floor(Date.now() / 1000);
  if (
    session.accountId !== token.accountId ||
    session.sessionId !== token.sessionId ||
    session.accessExpiresAt <= now ||
    session.refreshExpiresAt <= now ||
    !timingSafeEqual(session.accessHash, await sha256(token.secret))
  ) {
    return null;
  }
  return { accountId: token.accountId, sessionId: token.sessionId };
}

async function handleOAuthStart(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const redirectUri = url.searchParams.get("redirect_uri") || "";
  const codeChallenge = url.searchParams.get("code_challenge") || "";
  const clientState = url.searchParams.get("state") || "";
  if (
    !isAllowedRedirect(redirectUri, env) ||
    !/^[A-Za-z0-9_-]{43,128}$/u.test(codeChallenge) ||
    !/^[A-Za-z0-9_-]{43,128}$/u.test(clientState)
  ) {
    return fail(
      requestId(),
      "INVALID_REQUEST",
      "OAuth 요청이 올바르지 않습니다.",
      400,
    );
  }

  const stateToken = randomToken(32);
  const state: OAuthState = {
    redirectUri,
    codeChallenge,
    clientState,
    nonce: randomToken(32),
    expiresAt: Math.floor(Date.now() / 1000) + EXCHANGE_SECONDS,
  };
  await env.LINKU_DATA.put(
    `auth/oauth-states/${await sha256(stateToken)}.json`,
    JSON.stringify(state),
    { httpMetadata: { contentType: "application/json" } },
  );

  const google = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  google.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  google.searchParams.set("redirect_uri", googleCallbackUrl(env));
  google.searchParams.set("response_type", "code");
  google.searchParams.set("scope", "openid email profile");
  google.searchParams.set("state", stateToken);
  google.searchParams.set("nonce", state.nonce);
  google.searchParams.set("prompt", "select_account");
  return Response.redirect(google.toString(), 302);
}

async function handleOAuthCallback(
  request: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(request.url);
  const stateToken = url.searchParams.get("state");
  if (!stateToken || !TOKEN_PART_PATTERN.test(stateToken)) {
    return fail(
      requestId(),
      "INVALID_REQUEST",
      "OAuth 상태가 만료되었거나 올바르지 않습니다.",
      400,
    );
  }

  const stateKey = `auth/oauth-states/${await sha256(stateToken)}.json`;
  const stateObject = await env.LINKU_DATA.get(stateKey);
  if (!stateObject) {
    return fail(
      requestId(),
      "INVALID_REQUEST",
      "OAuth 상태가 만료되었거나 올바르지 않습니다.",
      400,
    );
  }
  await env.LINKU_DATA.delete(stateKey);
  const state = await stateObject.json<OAuthState>();
  if (
    state.expiresAt <= Math.floor(Date.now() / 1000) ||
    !isAllowedRedirect(state.redirectUri, env)
  ) {
    return fail(
      requestId(),
      "INVALID_REQUEST",
      "OAuth 상태가 만료되었거나 올바르지 않습니다.",
      400,
    );
  }

  const redirect = new URL(state.redirectUri);
  redirect.searchParams.set("state", state.clientState);
  const providerError = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  if (providerError || !code) {
    redirect.searchParams.set("error", providerError || "access_denied");
    return Response.redirect(redirect.toString(), 302);
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: googleCallbackUrl(env),
      grant_type: "authorization_code",
    }),
  });
  if (!tokenResponse.ok) {
    redirect.searchParams.set("error", "token_exchange_failed");
    return Response.redirect(redirect.toString(), 302);
  }

  const tokens = (await tokenResponse.json()) as { id_token?: string };
  if (!tokens.id_token) {
    redirect.searchParams.set("error", "missing_identity");
    return Response.redirect(redirect.toString(), 302);
  }

  let identity;
  try {
    identity = await verifyGoogleIdToken(
      tokens.id_token,
      env.GOOGLE_CLIENT_ID,
      state.nonce,
    );
  } catch {
    redirect.searchParams.set("error", "identity_unavailable");
    return Response.redirect(redirect.toString(), 302);
  }
  if (!identity) {
    redirect.searchParams.set("error", "invalid_identity");
    return Response.redirect(redirect.toString(), 302);
  }

  const accountId = await sha256(
    `https://accounts.google.com:${identity.sub}`,
  );
  const exchangeCode = randomToken(32);
  const exchange: OAuthExchange = {
    accountId,
    profile: {
      name: identity.name || "LinKU 사용자",
      email: identity.email,
      picture: identity.picture || "",
    },
    codeChallenge: state.codeChallenge,
    expiresAt: Math.floor(Date.now() / 1000) + EXCHANGE_SECONDS,
  };
  await env.LINKU_DATA.put(
    `auth/exchanges/${await sha256(exchangeCode)}.json`,
    JSON.stringify(exchange),
    { httpMetadata: { contentType: "application/json" } },
  );
  redirect.searchParams.set("code", exchangeCode);
  return Response.redirect(redirect.toString(), 302);
}

async function handleOAuthExchange(
  request: Request,
  env: Env,
): Promise<Response> {
  const body = await readJsonBody<{
    code?: string;
    verifier?: string;
    deviceId?: string;
  }>(request, JSON_LIMIT);
  if (
    !body.code ||
    !TOKEN_PART_PATTERN.test(body.code) ||
    !body.verifier ||
    !/^[A-Za-z0-9_-]{43,128}$/u.test(body.verifier) ||
    !body.deviceId ||
    !validResourceId(body.deviceId)
  ) {
    return fail(
      requestId(),
      "INVALID_REQUEST",
      "인증 교환 요청이 올바르지 않습니다.",
      400,
    );
  }

  const key = `auth/exchanges/${await sha256(body.code)}.json`;
  const object = await env.LINKU_DATA.get(key);
  if (!object) {
    return fail(
      requestId(),
      "UNAUTHENTICATED",
      "인증 코드가 만료되었습니다.",
      401,
    );
  }
  await env.LINKU_DATA.delete(key);
  const exchange = await object.json<OAuthExchange>();
  if (
    exchange.expiresAt <= Math.floor(Date.now() / 1000) ||
    !timingSafeEqual(await sha256(body.verifier), exchange.codeChallenge)
  ) {
    return fail(
      requestId(),
      "UNAUTHENTICATED",
      "인증 검증에 실패했습니다.",
      401,
    );
  }
  return ok(
    await createSession(
      env,
      exchange.accountId,
      exchange.profile,
      body.deviceId,
    ),
  );
}

async function handleRefresh(request: Request, env: Env): Promise<Response> {
  const body = await readJsonBody<{ refreshToken?: string }>(request, JSON_LIMIT);
  const token = parseSessionToken(body.refreshToken || "", "r");
  if (!token) {
    return fail(requestId(), "UNAUTHENTICATED", "세션이 올바르지 않습니다.", 401);
  }

  const key = `auth/sessions/${token.accountId}/${token.sessionId}.json`;
  const object = await env.LINKU_DATA.get(key);
  if (!object) {
    return fail(requestId(), "UNAUTHENTICATED", "세션이 만료되었습니다.", 401);
  }
  const session = await object.json<SessionRecord>();
  if (
    session.accountId !== token.accountId ||
    session.sessionId !== token.sessionId ||
    session.refreshExpiresAt <= Math.floor(Date.now() / 1000) ||
    !timingSafeEqual(session.refreshHash, await sha256(token.secret))
  ) {
    return fail(requestId(), "UNAUTHENTICATED", "세션이 만료되었습니다.", 401);
  }

  const tokens = await issueSessionTokens(
    token.accountId,
    token.sessionId,
    session.refreshExpiresAt,
  );
  const updated: SessionRecord = {
    ...session,
    accessHash: tokens.accessHash,
    accessExpiresAt: tokens.accessExpiresAt,
    refreshHash: tokens.refreshHash,
    refreshExpiresAt: tokens.refreshExpiresAt,
    updatedAt: new Date().toISOString(),
  };
  const saved = await env.LINKU_DATA.put(key, JSON.stringify(updated), {
    onlyIf: { etagMatches: object.etag },
    httpMetadata: { contentType: "application/json" },
  });
  if (!saved) {
    return fail(
      requestId(),
      "CONFLICT",
      "다른 요청에서 세션이 갱신되었습니다.",
      409,
      true,
    );
  }
  return ok<AuthSessionResponse>({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: new Date(tokens.accessExpiresAt * 1000).toISOString(),
    accountId: token.accountId,
    profile: session.profile,
  });
}

async function requireClaims(
  request: Request,
  env: Env,
  id: string,
): Promise<AccessClaims | Response> {
  return (
    (await authenticate(request, env)) ??
    fail(id, "UNAUTHENTICATED", "로그인이 필요합니다.", 401)
  );
}

function toIndexEntry(
  object: R2Object,
  prefix: string,
): SyncIndexEntry {
  return {
    id: object.key.slice(prefix.length, -".json".length),
    etag: object.etag,
    size: object.size,
    uploadedAt: object.uploaded.toISOString(),
    deleted: object.customMetadata?.deleted === "true" || undefined,
  };
}

async function handleSyncIndex(
  env: Env,
  claims: AccessClaims,
): Promise<Response> {
  const prefix = `private/${claims.accountId}/templates/`;
  const allTemplates = await listAll(env, prefix);
  const expired = allTemplates.filter(
    (object) =>
      object.customMetadata?.deleted === "true" &&
      object.uploaded.getTime() < Date.now() - TOMBSTONE_TTL_MS,
  );
  if (expired.length > 0) {
    await env.LINKU_DATA.delete(expired.map((object) => object.key));
  }
  const expiredKeys = new Set(expired.map((object) => object.key));
  const result: SyncIndexResponse = {
    templates: allTemplates
      .filter((object) => !expiredKeys.has(object.key))
      .map((object) => toIndexEntry(object, prefix)),
  };
  return ok(result);
}

async function handleTemplateResource(
  request: Request,
  env: Env,
  claims: AccessClaims,
  templateId: string,
): Promise<Response> {
  if (!validResourceId(templateId)) {
    return fail(
      requestId(),
      "INVALID_REQUEST",
      "템플릿 ID가 올바르지 않습니다.",
      400,
    );
  }
  const key = `private/${claims.accountId}/templates/${templateId}.json`;
  if (request.method === "GET") {
    const object = await env.LINKU_DATA.get(key);
    if (!object || object.customMetadata?.deleted === "true") {
      return fail(
        requestId(),
        "SHARE_NOT_FOUND",
        "템플릿을 찾을 수 없습니다.",
        404,
      );
    }
    return new Response(object.body, {
      headers: {
        "content-type": "application/json; charset=utf-8",
        etag: `"${object.etag}"`,
      },
    });
  }

  const conditions = conditionalHeaders(request);
  if (!conditions) {
    return fail(
      requestId(),
      "INVALID_REQUEST",
      "조건부 저장 헤더가 필요합니다.",
      428,
    );
  }

  if (request.method === "DELETE") {
    const existing = await env.LINKU_DATA.head(key);
    if (!existing) {
      return fail(
        requestId(),
        "SHARE_NOT_FOUND",
        "템플릿을 찾을 수 없습니다.",
        404,
      );
    }
    const saved = await env.LINKU_DATA.put(
      key,
      JSON.stringify({ deleted: true }),
      {
        onlyIf: conditions,
        customMetadata: { deleted: "true", schemaVersion: "1" },
        httpMetadata: { contentType: "application/json" },
      },
    );
    return saved
      ? ok({ deleted: true }, 200, { etag: `"${saved.etag}"` })
      : fail(
          requestId(),
          "CONFLICT",
          "다른 기기에서 템플릿이 변경되었습니다.",
          412,
          true,
        );
  }

  if (request.method === "PUT") {
    const existing = await env.LINKU_DATA.head(key);
    if (!existing) {
      const objects = await listAll(
        env,
        `private/${claims.accountId}/templates/`,
      );
      const activeCount = objects.filter(
        (object) => object.customMetadata?.deleted !== "true",
      ).length;
      if (activeCount >= MAX_TEMPLATES_PER_ACCOUNT) {
        return fail(
          requestId(),
          "RATE_LIMITED",
          "계정에는 템플릿을 최대 50개까지 동기화할 수 있습니다.",
          429,
        );
      }
    }

    const document = await readJsonBody<unknown>(request, JSON_LIMIT);
    if (!validateSyncedTemplateDocument(document, templateId)) {
      return fail(
        requestId(),
        "INVALID_REQUEST",
        "템플릿 데이터가 올바르지 않습니다.",
        400,
      );
    }
    const saved = await env.LINKU_DATA.put(key, JSON.stringify(document), {
      onlyIf: conditions,
      customMetadata: { deleted: "false", schemaVersion: "1" },
      httpMetadata: { contentType: "application/json" },
    });
    return saved
      ? ok({ etag: saved.etag }, 200, { etag: `"${saved.etag}"` })
      : fail(
          requestId(),
          "CONFLICT",
          "다른 기기에서 템플릿이 변경되었습니다.",
          412,
          true,
        );
  }

  return fail(
    requestId(),
    "INVALID_REQUEST",
    "지원하지 않는 요청입니다.",
    405,
  );
}

async function handleCreateShare(
  request: Request,
  env: Env,
  claims: AccessClaims,
): Promise<Response> {
  const payload = await readJsonBody<unknown>(request, JSON_LIMIT);
  try {
    validateTemplateSharePayload(payload);
  } catch {
    return fail(
      requestId(),
      "INVALID_REQUEST",
      "공유 템플릿이 올바르지 않습니다.",
      400,
    );
  }

  const shareId = randomToken(16);
  const now = new Date();
  const record: CloudShareRecord = {
    version: 1,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SHARE_TTL_MS).toISOString(),
    ownerId: claims.accountId,
    payload,
  };
  const indexPrefix = `private/${claims.accountId}/share-index/`;
  const existing = await listAll(env, indexPrefix);
  if (existing.length >= MAX_CLOUD_SHARES_PER_ACCOUNT) {
    const stale = existing
      .sort((left, right) => left.uploaded.getTime() - right.uploaded.getTime())
      .slice(0, existing.length - MAX_CLOUD_SHARES_PER_ACCOUNT + 1);
    await Promise.all(
      stale.flatMap((object) => {
        const staleId = object.key.slice(indexPrefix.length, -".json".length);
        return [
          env.LINKU_DATA.delete(object.key),
          env.LINKU_DATA.delete(`public/shares/${staleId}.json`),
        ];
      }),
    );
  }

  await Promise.all([
    env.LINKU_DATA.put(
      `public/shares/${shareId}.json`,
      JSON.stringify(record),
      {
        httpMetadata: {
          contentType: "application/json",
          cacheControl: "public, max-age=300",
        },
      },
    ),
    env.LINKU_DATA.put(
      `${indexPrefix}${shareId}.json`,
      JSON.stringify({ createdAt: record.createdAt, expiresAt: record.expiresAt }),
      { httpMetadata: { contentType: "application/json" } },
    ),
  ]);

  const shareUrl = new URL(env.SHARE_PAGE_URL);
  shareUrl.searchParams.set("cloud", shareId);
  return ok({ id: shareId, url: shareUrl.toString() }, 201);
}

async function handlePublicShare(
  request: Request,
  env: Env,
  shareId: string,
): Promise<Response> {
  if (!/^[A-Za-z0-9_-]{20,32}$/u.test(shareId)) {
    return fail(
      requestId(),
      "SHARE_NOT_FOUND",
      "공유를 찾을 수 없습니다.",
      404,
    );
  }
  const key = `public/shares/${shareId}.json`;
  if (request.method === "GET") {
    const object = await env.LINKU_DATA.get(key);
    if (!object) {
      return fail(
        requestId(),
        "SHARE_NOT_FOUND",
        "공유가 삭제되었거나 존재하지 않습니다.",
        404,
      );
    }
    const record: unknown = await object.json();
    if (!validateCloudShareRecord(record)) {
      await env.LINKU_DATA.delete(key);
      return fail(
        requestId(),
        "SHARE_NOT_FOUND",
        "공유 데이터가 손상되었습니다.",
        404,
      );
    }
    if (Date.parse(record.expiresAt) <= Date.now()) {
      await env.LINKU_DATA.delete(key);
      return fail(
        requestId(),
        "SHARE_NOT_FOUND",
        "공유가 만료되었습니다.",
        404,
      );
    }
    return ok(record.payload, 200, {
      "cache-control": "public, max-age=300",
      etag: `"${object.etag}"`,
    });
  }

  const claims = await authenticate(request, env);
  if (!claims) {
    return fail(requestId(), "UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  }
  const object = await env.LINKU_DATA.get(key);
  if (!object) {
    return fail(
      requestId(),
      "SHARE_NOT_FOUND",
      "공유를 찾을 수 없습니다.",
      404,
    );
  }
  const record: unknown = await object.json();
  if (!validateCloudShareRecord(record)) {
    await env.LINKU_DATA.delete(key);
    return fail(
      requestId(),
      "SHARE_NOT_FOUND",
      "공유 데이터가 손상되었습니다.",
      404,
    );
  }
  if (record.ownerId !== claims.accountId) {
    return fail(
      requestId(),
      "FORBIDDEN",
      "공유를 삭제할 권한이 없습니다.",
      403,
    );
  }
  await Promise.all([
    env.LINKU_DATA.delete(key),
    env.LINKU_DATA.delete(
      `private/${claims.accountId}/share-index/${shareId}.json`,
    ),
  ]);
  return ok({ deleted: true });
}

async function deletePrefix(env: Env, prefix: string): Promise<void> {
  const objects = await listAll(env, prefix);
  for (let index = 0; index < objects.length; index += 1_000) {
    await env.LINKU_DATA.delete(
      objects.slice(index, index + 1_000).map((object) => object.key),
    );
  }
}

async function deleteAccountData(env: Env, accountId: string): Promise<void> {
  const indexPrefix = `private/${accountId}/share-index/`;
  const shares = await listAll(env, indexPrefix);
  await Promise.all(
    shares.map((object) => {
      const shareId = object.key.slice(indexPrefix.length, -".json".length);
      return env.LINKU_DATA.delete(`public/shares/${shareId}.json`);
    }),
  );
  await Promise.all([
    deletePrefix(env, `private/${accountId}/`),
    deletePrefix(env, `auth/sessions/${accountId}/`),
  ]);
}

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  if (!path.startsWith("/api/")) {
    return fail(requestId(), "INVALID_REQUEST", "API 경로를 찾을 수 없습니다.", 404);
  }

  const requestOrigin = request.headers.get("origin");
  if (requestOrigin && !allowedOrigin(request, env)) {
    return fail(requestId(), "FORBIDDEN", "허용되지 않은 출처입니다.", 403);
  }
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (path === "/api/health" && request.method === "GET") {
    return ok({ status: "ok" });
  }

  if (
    path === "/api/auth/google/start" ||
    path === "/api/auth/google/callback" ||
    path === "/api/auth/exchange" ||
    path === "/api/auth/refresh"
  ) {
    const limited = await enforceRateLimit(
      env.AUTH_RATE_LIMITER,
      `${path}:${requestActor(request)}`,
    );
    if (limited) return limited;
  }
  if (path === "/api/auth/google/start" && request.method === "GET") {
    return handleOAuthStart(request, env);
  }
  if (path === "/api/auth/google/callback" && request.method === "GET") {
    return handleOAuthCallback(request, env);
  }
  if (path === "/api/auth/exchange" && request.method === "POST") {
    return handleOAuthExchange(request, env);
  }
  if (path === "/api/auth/refresh" && request.method === "POST") {
    return handleRefresh(request, env);
  }

  const shareMatch = path.match(/^\/api\/shares\/v1\/([A-Za-z0-9_-]+)$/u);
  if (shareMatch && (request.method === "GET" || request.method === "DELETE")) {
    const limited = await enforceRateLimit(
      env.PUBLIC_RATE_LIMITER,
      `${request.method}:${requestActor(request)}`,
    );
    if (limited) return limited;
    return handlePublicShare(request, env, shareMatch[1]);
  }

  const actorLimited = await enforceRateLimit(
    env.USER_RATE_LIMITER,
    `ip:${requestActor(request)}`,
  );
  if (actorLimited) return actorLimited;

  const id = requestId();
  const claimsOrResponse = await requireClaims(request, env, id);
  if (claimsOrResponse instanceof Response) return claimsOrResponse;
  const claims = claimsOrResponse;
  const limited = await enforceRateLimit(
    env.USER_RATE_LIMITER,
    `account:${claims.accountId}`,
  );
  if (limited) return limited;

  if (path === "/api/auth/logout" && request.method === "POST") {
    await env.LINKU_DATA.delete(
      `auth/sessions/${claims.accountId}/${claims.sessionId}.json`,
    );
    return ok({ loggedOut: true });
  }
  if (path === "/api/account" && request.method === "DELETE") {
    await deleteAccountData(env, claims.accountId);
    return ok({ deleted: true });
  }
  if (path === "/api/sync/v1/index" && request.method === "GET") {
    return handleSyncIndex(env, claims);
  }
  const templateMatch = path.match(
    /^\/api\/sync\/v1\/templates\/([^/]+)$/u,
  );
  if (templateMatch) {
    return handleTemplateResource(
      request,
      env,
      claims,
      decodeURIComponent(templateMatch[1]),
    );
  }
  if (path === "/api/shares/v1" && request.method === "POST") {
    return handleCreateShare(request, env, claims);
  }
  return fail(id, "INVALID_REQUEST", "API 경로를 찾을 수 없습니다.", 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return addResponseHeaders(await route(request, env), request, env);
    } catch (error) {
      const id = requestId();
      if (error instanceof RangeError && error.message === "PAYLOAD_TOO_LARGE") {
        return addResponseHeaders(
          fail(id, "PAYLOAD_TOO_LARGE", "요청 데이터가 너무 큽니다.", 413),
          request,
          env,
        );
      }
      if (error instanceof SyntaxError) {
        return addResponseHeaders(
          fail(id, "INVALID_REQUEST", "JSON 요청이 올바르지 않습니다.", 400),
          request,
          env,
        );
      }
      // eslint-disable-next-line no-console -- request ID is needed for Worker log correlation.
      console.error("Worker request failed", {
        requestId: id,
        path: new URL(request.url).pathname,
      });
      return addResponseHeaders(
        fail(
          id,
          "UPSTREAM_UNAVAILABLE",
          "일시적인 서버 오류가 발생했습니다.",
          500,
          true,
        ),
        request,
        env,
      );
    }
  },
} satisfies ExportedHandler<Env>;
