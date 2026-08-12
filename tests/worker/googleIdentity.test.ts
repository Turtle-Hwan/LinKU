import assert from "node:assert/strict";
import test from "node:test";

import { verifyGoogleIdToken } from "../../worker/googleIdentity.ts";

function base64Url(value: Uint8Array | string): string {
  const bytes =
    typeof value === "string" ? new TextEncoder().encode(value) : value;
  return Buffer.from(bytes).toString("base64url");
}

async function signedToken(
  privateKey: CryptoKey,
  claims: Record<string, unknown>,
): Promise<string> {
  const header = base64Url(JSON.stringify({ alg: "RS256", kid: "test-key" }));
  const payload = base64Url(JSON.stringify(claims));
  const input = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(input),
  );
  return `${input}.${base64Url(new Uint8Array(signature))}`;
}

test("Google ID token은 서명, audience, nonce를 모두 검증한다", async (context) => {
  const keys = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const jwk = await crypto.subtle.exportKey("jwk", keys.publicKey);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({ keys: [{ ...jwk, kid: "test-key", alg: "RS256", use: "sig" }] }),
      { headers: { "cache-control": "max-age=60" } },
    );
  context.after(() => {
    globalThis.fetch = originalFetch;
  });

  const now = Math.floor(Date.now() / 1000);
  const claims = {
    sub: "google-user-id",
    email: "user@example.com",
    email_verified: true,
    name: "LinKU User",
    picture: "https://example.com/avatar.png",
    iss: "https://accounts.google.com",
    aud: "linku-client-id",
    exp: now + 300,
    iat: now,
    nonce: "expected-nonce",
  };
  const token = await signedToken(keys.privateKey, claims);

  assert.deepEqual(
    await verifyGoogleIdToken(
      token,
      "linku-client-id",
      "expected-nonce",
    ),
    {
      sub: "google-user-id",
      email: "user@example.com",
      name: "LinKU User",
      picture: "https://example.com/avatar.png",
    },
  );
  assert.equal(
    await verifyGoogleIdToken(token, "another-client", "expected-nonce"),
    null,
  );
  assert.equal(
    await verifyGoogleIdToken(token, "linku-client-id", "wrong-nonce"),
    null,
  );
});
