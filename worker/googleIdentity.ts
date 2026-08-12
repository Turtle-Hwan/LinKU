const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = new Set([
  "accounts.google.com",
  "https://accounts.google.com",
]);
const CLOCK_SKEW_SECONDS = 5 * 60;

interface GoogleJwk extends JsonWebKey {
  alg?: string;
  kid?: string;
  use?: string;
}

interface GoogleJwkSet {
  keys: GoogleJwk[];
}

interface GoogleIdTokenHeader {
  alg?: string;
  kid?: string;
}

export interface GoogleIdentityClaims {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}

interface GoogleIdTokenClaims extends GoogleIdentityClaims {
  aud: string | string[];
  azp?: string;
  email_verified: boolean;
  exp: number;
  iat: number;
  iss: string;
  nonce: string;
}

let cachedKeys: { expiresAt: number; keys: GoogleJwk[] } | null = null;

function decodeBase64Url(value: string): ArrayBuffer {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function parseJsonPart<T>(value: string): T | null {
  try {
    return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as T;
  } catch {
    return null;
  }
}

function cacheTtl(response: Response): number {
  const match = response.headers.get("cache-control")?.match(/max-age=(\d+)/u);
  const seconds = match ? Number(match[1]) : 60 * 60;
  return Math.min(Math.max(seconds, 60), 24 * 60 * 60) * 1000;
}

async function getGoogleKeys(forceRefresh = false): Promise<GoogleJwk[]> {
  if (!forceRefresh && cachedKeys && cachedKeys.expiresAt > Date.now()) {
    return cachedKeys.keys;
  }

  const response = await fetch(GOOGLE_JWKS_URL);
  if (!response.ok) {
    throw new Error("Google signing keys are unavailable");
  }
  const jwks = (await response.json()) as GoogleJwkSet;
  if (!Array.isArray(jwks.keys) || jwks.keys.length === 0) {
    throw new Error("Google signing keys are invalid");
  }
  cachedKeys = {
    expiresAt: Date.now() + cacheTtl(response),
    keys: jwks.keys,
  };
  return jwks.keys;
}

async function findGoogleKey(kid: string): Promise<GoogleJwk | null> {
  const keys = await getGoogleKeys();
  const cached = keys.find((key) => key.kid === kid);
  if (cached) return cached;

  // Google rotates keys. Retry once without the isolate-local cache.
  const refreshed = await getGoogleKeys(true);
  return refreshed.find((key) => key.kid === kid) ?? null;
}

function hasExpectedAudience(
  audience: unknown,
  clientId: string,
): boolean {
  if (typeof audience === "string") return audience === clientId;
  return Array.isArray(audience) &&
    audience.every((value) => typeof value === "string") &&
    audience.includes(clientId);
}

export async function verifyGoogleIdToken(
  idToken: string,
  clientId: string,
  expectedNonce: string,
): Promise<GoogleIdentityClaims | null> {
  const [encodedHeader, encodedPayload, encodedSignature, extra] =
    idToken.split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature || extra) {
    return null;
  }

  const header = parseJsonPart<GoogleIdTokenHeader>(encodedHeader);
  const claims = parseJsonPart<GoogleIdTokenClaims>(encodedPayload);
  if (!header || !claims || header.alg !== "RS256" || !header.kid) {
    return null;
  }

  const key = await findGoogleKey(header.kid);
  if (!key || (key.alg && key.alg !== "RS256") || (key.use && key.use !== "sig")) {
    return null;
  }
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    key,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const validSignature = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    decodeBase64Url(encodedSignature),
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
  );
  if (!validSignature) return null;

  const now = Math.floor(Date.now() / 1000);
  if (
    typeof claims.sub !== "string" ||
    !claims.sub ||
    typeof claims.email !== "string" ||
    !claims.email ||
    claims.email_verified !== true ||
    typeof claims.iss !== "string" ||
    !GOOGLE_ISSUERS.has(claims.iss) ||
    !hasExpectedAudience(claims.aud, clientId) ||
    (claims.azp !== undefined && claims.azp !== clientId) ||
    typeof claims.exp !== "number" ||
    claims.exp <= now ||
    typeof claims.iat !== "number" ||
    claims.iat > now + CLOCK_SKEW_SECONDS ||
    typeof claims.nonce !== "string" ||
    (claims.name !== undefined && typeof claims.name !== "string") ||
    (claims.picture !== undefined && typeof claims.picture !== "string") ||
    claims.nonce !== expectedNonce
  ) {
    return null;
  }

  return {
    sub: claims.sub,
    email: claims.email,
    name: claims.name,
    picture: claims.picture,
  };
}
