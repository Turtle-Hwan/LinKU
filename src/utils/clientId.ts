/**
 * Client ID 관리 유틸리티
 * 기기별 고유 식별자를 생성하고 관리합니다.
 */

/**
 * Client ID 생성 및 가져오기
 * 사용자별 고유 ID로 chrome.storage에 저장됨
 * @returns Promise<string> - 기기 고유 UUID
 */
export async function getOrCreateClientId(): Promise<string> {
  try {
    const result = await chrome.storage.local.get("clientId");
    let clientId = result.clientId;

    if (!clientId) {
      // UUID v4 생성
      clientId = self.crypto.randomUUID();
      await chrome.storage.local.set({ clientId });
    }

    return clientId;
  } catch (error) {
    console.error("[ClientID] Error getting/creating client ID:", error);
    // 에러 시 임시 ID 반환
    return "error-" + Date.now();
  }
}
