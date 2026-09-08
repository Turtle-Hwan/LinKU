import assert from 'node:assert/strict';
import test from 'node:test';
import { ensureTrustedStorageAccess } from '../../src/utils/chromeStorageAccess.ts';

test('저장소 격리에 실패하면 거부하고 다음 시도에서 재검증한다', async () => {
  const previous = globalThis.chrome;
  let calls = 0;
  let fail = true;
  const local: { setAccessLevel?: (value: unknown) => Promise<void> } = {};
  Object.defineProperty(globalThis, 'chrome', { configurable: true, value: { storage: { local } } });
  try {
    await assert.rejects(ensureTrustedStorageAccess());
    local.setAccessLevel = async (value) => {
      calls++;
      assert.deepEqual(value, { accessLevel: 'TRUSTED_CONTEXTS' });
      if (fail) throw new Error('synthetic failure');
    };
    await assert.rejects(ensureTrustedStorageAccess());
    fail = false;
    await Promise.all([ensureTrustedStorageAccess(), ensureTrustedStorageAccess()]);
    assert.equal(calls, 2);
    await ensureTrustedStorageAccess();
    assert.equal(calls, 2);
  } finally {
    Object.defineProperty(globalThis, 'chrome', { configurable: true, value: previous });
  }
});
