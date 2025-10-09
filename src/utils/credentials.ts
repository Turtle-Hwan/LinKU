/**
 * Credentials 관리 유틸리티
 * 여러 서비스의 로그인 인증 정보를 암호화하여 저장/불러오기
 */

import { getStorage, setStorage, removeStorage } from "./chrome";
import { encryptPassword, decryptPassword } from "./crypto";

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
  try {
    const encryptedPassword = await encryptPassword(password);
    await setStorage({
      [storageKey]: { id, password: encryptedPassword },
    });
  } catch (error) {
    console.error(
      `[Credentials] Error saving credentials (${storageKey}):`,
      error
    );
    throw error;
  }
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

    // 비밀번호 복호화
    let decryptedPassword: string;
    try {
      decryptedPassword = await decryptPassword(credentials.password);
    } catch {
      // 복호화 실패 시 평문으로 시도 (이전 데이터 호환성)
      decryptedPassword = credentials.password;
    }

    return {
      id: credentials.id,
      password: decryptedPassword,
    };
  } catch (error) {
    console.error(
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
  try {
    await removeStorage(storageKey);
  } catch (error) {
    console.error(
      `[Credentials] Error clearing credentials (${storageKey}):`,
      error
    );
    throw error;
  }
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
