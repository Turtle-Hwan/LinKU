"use client";

export interface SecureCredentials {
  id: string;
  password: string;
}

const CLIENT_ID_KEY = "linku.web.client-id.v1";
const ECAMPUS_CREDENTIALS_KEY = "linku.web.ecampus-credentials.v1";
const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const PBKDF2_ITERATIONS = 100_000;

function canUseBrowserCrypto() {
  return (
    typeof window !== "undefined" &&
    typeof window.localStorage !== "undefined" &&
    typeof window.crypto !== "undefined" &&
    typeof window.crypto.subtle !== "undefined"
  );
}

function bufferToHex(buffer: Uint8Array) {
  return Array.from(buffer)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBuffer(hex: string) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < hex.length; index += 2) {
    bytes[index / 2] = parseInt(hex.slice(index, index + 2), 16);
  }
  return bytes;
}

function bufferToBase64(buffer: Uint8Array) {
  let binary = "";
  for (const value of buffer) {
    binary += String.fromCharCode(value);
  }
  return window.btoa(binary);
}

function base64ToBuffer(base64: string) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
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

async function deriveKey(clientId: string, salt: Uint8Array) {
  const encoder = new TextEncoder();
  const keyMaterial = encoder.encode(clientId);

  const importedKey = await window.crypto.subtle.importKey(
    "raw",
    keyMaterial,
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    importedKey,
    {
      name: ALGORITHM,
      length: KEY_LENGTH,
    },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptSecret(value: string) {
  const clientId = await getOrCreateClientId();
  const salt = window.crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(clientId, salt);
  const encodedValue = new TextEncoder().encode(value);
  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv: iv as unknown as BufferSource,
    },
    key,
    encodedValue as unknown as BufferSource,
  );

  return [
    bufferToHex(salt),
    bufferToHex(iv),
    bufferToBase64(new Uint8Array(encrypted)),
  ].join(":");
}

async function decryptSecret(value: string) {
  const [saltHex, ivHex, encryptedBase64] = value.split(":");
  if (!saltHex || !ivHex || !encryptedBase64) {
    return value;
  }

  const clientId = await getOrCreateClientId();
  const key = await deriveKey(clientId, hexToBuffer(saltHex));
  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: ALGORITHM,
      iv: hexToBuffer(ivHex) as unknown as BufferSource,
    },
    key,
    base64ToBuffer(encryptedBase64) as unknown as BufferSource,
  );

  return new TextDecoder().decode(decrypted);
}

export async function saveECampusCredentials(credentials: SecureCredentials) {
  if (!canUseBrowserCrypto()) {
    return;
  }

  const encryptedPassword = await encryptSecret(credentials.password);
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

    return {
      id: parsedValue.id,
      password: await decryptSecret(parsedValue.password),
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
