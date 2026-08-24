/**
 * Credentials 관리 유틸리티
 * 여러 서비스의 로그인 인증 정보를 암호화하여 저장/불러오기
 */

import { getStorage, setStorage, removeStorage } from "./chrome";
import { encryptPassword, decryptPassword, looksEncrypted } from "./crypto";
import { captureErrorLog, captureWarnLog } from '@/utils/logger';

export interface Credentials {
  id: string;
  password: string;
}

/**
 * 인증 정보를 암호화하여 저장
 * @param storageKey 저장할 storage 키 (예: "ecampus_credentials", "library_credentials")
 * @param id 사용자 ID
 * @param password 평문 비밀번호
 */
export async function saveCredentials(
  storageKey: string,
  id: string,
  password: string
): Promise<void> {
  const encryptedPassword = await encryptPassword(password);
  await setStorage({
    [storageKey]: { id, password: encryptedPassword },
  });
}

/**
 * 저장된 인증 정보를 불러와서 복호화
 * @param storageKey 불러올 storage 키 (예: "ecampus_credentials", "library_credentials")
 * @returns 복호화된 인증 정보 또는 null
 */
export async function loadCredentials(
  storageKey: string
): Promise<Credentials | null> {
  try {
    const credentials = await getStorage<{ id: string; password: string }>(
      storageKey
    );

    if (!credentials?.id || !credentials?.password) {
      return null;
    }

    const stored = credentials.password;

    // 암호문 형식이 아니면 암호화 도입 이전에 저장된 평문으로 본다.
    if (!looksEncrypted(stored)) {
      return { id: credentials.id, password: stored };
    }

    let decryptedPassword: string;
    try {
      decryptedPassword = await decryptPassword(stored);
    } catch (error) {
      // 암호문을 그대로 돌려주면 eCampus 로그인 요청에 암호문이 비밀번호로
      // 실려 나가고, 실패한 자동 로그인이 저장된 자격증명을 지운다.
      // 복호화에 실패하면 자격증명이 없는 것으로 취급한다.
      captureWarnLog(
        "[Credentials] Password decryption failed; discarding stored credentials",
        error,
      );
      return null;
    }

    return {
      id: credentials.id,
      password: decryptedPassword,
    };
  } catch (error) {
    captureErrorLog(
      `[Credentials] Error loading credentials (${storageKey}):`,
      error
    );
    return null;
  }
}

/**
 * 저장된 인증 정보 삭제
 * @param storageKey 삭제할 storage 키 (예: "ecampus_credentials", "library_credentials")
 */
export async function clearCredentials(storageKey: string): Promise<void> {
  await removeStorage(storageKey);
}

// ==================== eCampus 전용 헬퍼 함수 ====================
// 기존 코드 호환성을 위해 eCampus 전용 래퍼 함수 제공

const ECAMPUS_STORAGE_KEY = "eCampusCredentials";

/**
 * eCampus 인증 정보 저장
 */
export async function saveECampusCredentials(
  id: string,
  password: string
): Promise<void> {
  return saveCredentials(ECAMPUS_STORAGE_KEY, id, password);
}

/**
 * eCampus 인증 정보 불러오기
 */
export async function loadECampusCredentials(): Promise<Credentials | null> {
  return loadCredentials(ECAMPUS_STORAGE_KEY);
}

/**
 * eCampus 인증 정보 삭제
 */
export async function clearECampusCredentials(): Promise<void> {
  return clearCredentials(ECAMPUS_STORAGE_KEY);
}
