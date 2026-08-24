/**
 * Client ID 관리 유틸리티
 * 기기별 고유 식별자를 생성하고 관리합니다.
 */

import { getStorage, setStorage } from "./chrome";
import { recordBreadcrumb } from "@/monitoring";
import { getErrorLogDetails, warnLog } from "@/utils/logger";

/**
 * storage를 읽지 못했을 때 반환하는 임시 ID의 접두사.
 * 이 값은 호출할 때마다 달라지므로 기기 식별자로도, 암호화 키 재료로도 쓸 수 없다.
 */
const EPHEMERAL_PREFIX = "error-";

/**
 * 영구 저장되는 client ID를 읽거나 새로 만든다.
 *
 * 자격증명 암호화처럼 같은 ID를 다시 읽어야 하는 호출자는 이 엄격한 경로를
 * 사용한다. storage 실패를 임시 ID로 숨기지 않고 최종 처리 경계로 전달한다.
 */
export async function getOrCreatePersistentClientId(): Promise<string> {
  let clientId = await getStorage<string>("clientId");

  if (!clientId) {
    clientId = self.crypto.randomUUID();
    await setStorage({ clientId });
  }

  return clientId;
}

/**
 * Client ID 생성 및 가져오기
 * 사용자별 고유 ID로 chrome.storage에 저장됨
 * @returns Promise<string> - 기기 고유 UUID
 */
export async function getOrCreateClientId(): Promise<string> {
  try {
    return await getOrCreatePersistentClientId();
  } catch (error) {
    const details = getErrorLogDetails(error);
    recordBreadcrumb(
      "analytics.storage",
      "client ID storage unavailable; using an ephemeral ID",
      { error: details },
      "warning",
    );
    warnLog("[ClientID] Using an ephemeral client ID", details);
    // 에러 시 임시 ID 반환 (analytics 전용, 키 재료로는 쓰지 말 것)
    return EPHEMERAL_PREFIX + Date.now();
  }
}
