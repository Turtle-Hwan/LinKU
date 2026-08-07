"use client";

import {
  decryptSecret,
  encryptSecret,
  isEncryptedSecret,
} from "@linku/platform";

export interface SecureCredentials {
  id: string;
  password: string;
}

const CLIENT_ID_KEY = "linku.web.client-id.v1";
const ECAMPUS_CREDENTIALS_KEY = "linku.web.ecampus-credentials.v1";
function canUseBrowserCrypto() {
  return (
    typeof window !== "undefined" &&
    typeof window.localStorage !== "undefined" &&
    typeof window.crypto !== "undefined" &&
    typeof window.crypto.subtle !== "undefined"
  );
}

async function getOrCreateClientId() {
  if (!canUseBrowserCrypto()) {
    return `linku-web-${Date.now()}`;
  }

  const existingValue = window.localStorage.getItem(CLIENT_ID_KEY);
  if (existingValue) {
    return existingValue;
  }

  const nextValue = window.crypto.randomUUID();
  window.localStorage.setItem(CLIENT_ID_KEY, nextValue);
  return nextValue;
}

export async function saveECampusCredentials(credentials: SecureCredentials) {
  if (!canUseBrowserCrypto()) {
    return;
  }

  const encryptedPassword = await encryptSecret(
    credentials.password,
    await getOrCreateClientId(),
  );
  window.localStorage.setItem(
    ECAMPUS_CREDENTIALS_KEY,
    JSON.stringify({
      id: credentials.id,
      password: encryptedPassword,
    }),
  );
}

export async function loadECampusCredentials() {
  if (!canUseBrowserCrypto()) {
    return null;
  }

  const rawValue = window.localStorage.getItem(ECAMPUS_CREDENTIALS_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as Partial<SecureCredentials>;
    if (typeof parsedValue.id !== "string" || typeof parsedValue.password !== "string") {
      return null;
    }

    const password = isEncryptedSecret(parsedValue.password)
      ? await decryptSecret(parsedValue.password, await getOrCreateClientId())
      : parsedValue.password;

    return {
      id: parsedValue.id,
      password,
    } satisfies SecureCredentials;
  } catch {
    return null;
  }
}

export function clearECampusCredentials() {
  if (!canUseBrowserCrypto()) {
    return;
  }

  window.localStorage.removeItem(ECAMPUS_CREDENTIALS_KEY);
}

export function hasStoredECampusCredentials() {
  if (!canUseBrowserCrypto()) {
    return false;
  }

  return Boolean(window.localStorage.getItem(ECAMPUS_CREDENTIALS_KEY));
}
