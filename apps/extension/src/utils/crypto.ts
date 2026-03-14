/**
 * 비밀번호 암호화/복호화 유틸리티
 * WebCrypto API를 사용한 AES-GCM 암호화
 */

import { getOrCreateClientId } from "./clientId";

// 암호화 설정
const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // AES-GCM 권장 IV 길이
const SALT_LENGTH = 16;
const PBKDF2_ITERATIONS = 100000; // OWASP 권장 최소값

/**
 * ClientID를 기반으로 암호화 키 생성
 * PBKDF2를 사용하여 키 파생
 */
async function deriveKey(clientId: string, salt: Uint8Array): Promise<CryptoKey> {
  // TextEncoder를 사용하여 clientId를 Uint8Array로 변환
  const encoder = new TextEncoder();
  const keyMaterial = encoder.encode(clientId);

  // 키 material을 CryptoKey로 임포트
  const importedKey = await crypto.subtle.importKey(
    "raw",
    keyMaterial as BufferSource,
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  // PBKDF2로 AES-GCM 키 파생
  return crypto.subtle.deriveKey(
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
    ["encrypt", "decrypt"]
  );
}

/**
 * Uint8Array를 hex 문자열로 변환
 */
function bufferToHex(buffer: Uint8Array): string {
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * hex 문자열을 Uint8Array로 변환
 */
function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Uint8Array를 Base64 문자열로 변환
 */
function bufferToBase64(buffer: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

/**
 * Base64 문자열을 Uint8Array로 변환
 */
function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * 비밀번호 암호화
 * @param password - 암호화할 평문 비밀번호
 * @returns Promise<string> - "salt:iv:암호문" 형식의 문자열 (모두 hex 또는 base64)
 */
export async function encryptPassword(password: string): Promise<string> {
  try {
    // ClientID 가져오기
    const clientId = await getOrCreateClientId();

    // Salt와 IV 생성 (랜덤)
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

    // 암호화 키 파생
    const key = await deriveKey(clientId, salt);

    // 비밀번호를 Uint8Array로 변환
    const encoder = new TextEncoder();
    const data = encoder.encode(password);

    // AES-GCM 암호화
    const encryptedData = await crypto.subtle.encrypt(
      {
        name: ALGORITHM,
        iv: iv as BufferSource,
      },
      key,
      data as BufferSource
    );

    // 결과를 "salt:iv:암호문" 형식으로 저장
    const saltHex = bufferToHex(salt);
    const ivHex = bufferToHex(iv);
    const encryptedBase64 = bufferToBase64(new Uint8Array(encryptedData));

    return `${saltHex}:${ivHex}:${encryptedBase64}`;
  } catch (error) {
    console.error("[Crypto] Encryption error:", error);
    throw new Error("비밀번호 암호화에 실패했습니다.");
  }
}

/**
 * 비밀번호 복호화
 * @param encryptedData - "salt:iv:암호문" 형식의 암호화된 문자열
 * @returns Promise<string> - 복호화된 평문 비밀번호
 */
export async function decryptPassword(encryptedData: string): Promise<string> {
  try {
    // "salt:iv:암호문" 형식 파싱
    const parts = encryptedData.split(":");
    if (parts.length !== 3) {
      throw new Error("Invalid encrypted data format");
    }

    const [saltHex, ivHex, encryptedBase64] = parts;

    // Hex와 Base64를 Uint8Array로 변환
    const salt = hexToBuffer(saltHex);
    const iv = hexToBuffer(ivHex);
    const encryptedBytes = base64ToBuffer(encryptedBase64);

    // ClientID 가져오기
    const clientId = await getOrCreateClientId();

    // 암호화 키 파생
    const key = await deriveKey(clientId, salt);

    // AES-GCM 복호화
    const decryptedData = await crypto.subtle.decrypt(
      {
        name: ALGORITHM,
        iv: iv as BufferSource,
      },
      key,
      encryptedBytes as BufferSource
    );

    // Uint8Array를 문자열로 변환
    const decoder = new TextDecoder();
    return decoder.decode(decryptedData);
  } catch (error) {
    console.error("[Crypto] Decryption error:", error);
    throw new Error("비밀번호 복호화에 실패했습니다.");
  }
}
