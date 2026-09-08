let restriction: Promise<void> | undefined;

export async function ensureTrustedStorageAccess(): Promise<void> {
  if (!globalThis.chrome?.storage?.local) return;
  if (!restriction) {
    restriction = Promise.resolve().then(async () => {
      if (typeof chrome.storage.local.setAccessLevel !== 'function') {
        throw new Error('계정 저장소를 보호할 수 없습니다. Chrome을 업데이트한 뒤 다시 시도해 주세요.');
      }
      await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
    }).catch((error: unknown) => {
      restriction = undefined;
      throw error;
    });
  }
  await restriction;
}
