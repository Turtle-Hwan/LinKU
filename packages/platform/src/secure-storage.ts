const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const PBKDF2_ITERATIONS = 100_000;

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string) {
  if (hex.length % 2 !== 0 || !/^[\da-f]+$/i.test(hex)) {
    throw new Error("Invalid hexadecimal value.");
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < hex.length; index += 2) {
    bytes[index / 2] = Number.parseInt(hex.slice(index, index + 2), 16);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const value of bytes) {
    binary += String.fromCharCode(value);
  }
  return globalThis.btoa(binary);
}

function base64ToBytes(base64: string) {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function deriveKey(
  clientId: string,
  salt: Uint8Array,
  cryptoProvider: Crypto,
) {
  const keyMaterial = new TextEncoder().encode(clientId);
  const importedKey = await cryptoProvider.subtle.importKey(
    "raw",
    keyMaterial as BufferSource,
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return cryptoProvider.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
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

export function isEncryptedSecret(value: string) {
  const [salt, iv, encrypted, ...rest] = value.split(":");
  return Boolean(
    salt &&
      iv &&
      encrypted &&
      rest.length === 0 &&
      salt.length === SALT_LENGTH * 2 &&
      iv.length === IV_LENGTH * 2 &&
      /^[\da-f]+$/i.test(salt) &&
      /^[\da-f]+$/i.test(iv),
  );
}

export async function encryptSecret(
  value: string,
  clientId: string,
  cryptoProvider = globalThis.crypto,
) {
  const salt = cryptoProvider.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = cryptoProvider.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(clientId, salt, cryptoProvider);
  const encodedValue = new TextEncoder().encode(value);
  const encrypted = await cryptoProvider.subtle.encrypt(
    {
      name: ALGORITHM,
      iv: iv as BufferSource,
    },
    key,
    encodedValue as BufferSource,
  );

  return [
    bytesToHex(salt),
    bytesToHex(iv),
    bytesToBase64(new Uint8Array(encrypted)),
  ].join(":");
}

export async function decryptSecret(
  value: string,
  clientId: string,
  cryptoProvider = globalThis.crypto,
) {
  if (!isEncryptedSecret(value)) {
    throw new Error("Invalid encrypted data format.");
  }

  const [saltHex, ivHex, encryptedBase64] = value.split(":");
  const salt = hexToBytes(saltHex);
  const iv = hexToBytes(ivHex);
  const encrypted = base64ToBytes(encryptedBase64);
  const key = await deriveKey(clientId, salt, cryptoProvider);
  const decrypted = await cryptoProvider.subtle.decrypt(
    {
      name: ALGORITHM,
      iv: iv as BufferSource,
    },
    key,
    encrypted as BufferSource,
  );

  return new TextDecoder().decode(decrypted);
}
