/**
 * Client ID 관리 유틸리티
 * 기기별 고유 식별자를 생성하고 관리합니다.
 */

import { getStorage, setStorage } from "./chrome";
import { errorLog } from '@/utils/logger';

/**
 * storage를 읽지 못했을 때 반환하는 임시 ID의 접두사.
 * 이 값은 호출할 때마다 달라지므로 기기 식별자로도, 암호화 키 재료로도 쓸 수 없다.
 */
const EPHEMERAL_PREFIX = "error-";

/**
 * 이 clientId가 storage 실패로 만들어진 일회성 값인지 판별한다.
 *
 * analytics는 이 값이라도 받아 이벤트를 흘려보내면 그만이지만, 자격증명 암호화는
 * 다르다. 매번 다른 값으로 키를 파생하면 저장한 비밀번호를 다시는 복호화할 수 없다.
 */
export function isEphemeralClientId(clientId: string): boolean {
  return clientId.startsWith(EPHEMERAL_PREFIX);
}

/**
 * Client ID 생성 및 가져오기
 * 사용자별 고유 ID로 chrome.storage에 저장됨
 * @returns Promise<string> - 기기 고유 UUID
 */
export async function getOrCreateClientId(): Promise<string> {
  try {
    let clientId = await getStorage<string>("clientId");

    if (!clientId) {
      // UUID v4 생성
      clientId = self.crypto.randomUUID();
      await setStorage({ clientId });
    }

    return clientId;
  } catch (error) {
    errorLog("[ClientID] Error getting/creating client ID:", error);
    // 에러 시 임시 ID 반환 (analytics 전용, 키 재료로는 쓰지 말 것)
    return EPHEMERAL_PREFIX + Date.now();
  }
}
