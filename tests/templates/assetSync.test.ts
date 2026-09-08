import assert from 'node:assert/strict';
import test from 'node:test';
import 'fake-indexeddb/auto';
import { createTemplateTestServer } from './viteTestServer.ts';
import type { StoredAsset, StoredTemplate } from '../../src/storage/indexedDb/linkuDatabase.ts';
import type { RemoteAsset } from '../../src/apis/supabase/templates.ts';

test('개인 아이콘의 로컬 변경·다기기 동기화·삭제 충돌', async (t) => {
  const asset: StoredAsset = {
    id: 'a'.repeat(64), numericId: 1234, name: '이전 이름',
    blob: new Blob(['same image'], { type: 'image/webp' }), dataUrl: 'data:image/webp;base64,c2FtZQ==', createdAt: 1,
  };
  let remote: RemoteAsset | null = { contentHash: asset.id, name: asset.name, revision: 1, objectPath: 'account/image.webp' };
  let unavailable = false;
  let blocked = false;
  let uploads = 0;
  let renameDuringRequest: (() => Promise<void>) | undefined;
  let conflict: () => Error;
  let inUse: () => Error;
  const scope = globalThis as typeof globalThis & { assetSyncTest?: unknown };
  scope.assetSyncTest = {
    listRemoteAssets: async () => remote ? [remote] : [],
    getRemoteAsset: async () => remote,
    downloadRemoteAsset: async () => { throw new Error('existing images must not be downloaded'); },
    uploadRemoteAsset: async () => { uploads++; throw new Error('renames must not upload images'); },
    putRemoteAsset: async (_id: string, name: string, revision: number) => {
      if (unavailable) throw new TypeError('Failed to fetch');
      if (!remote || remote.revision !== revision) throw conflict();
      const saved = { ...remote, name, revision: revision + 1 };
      remote = saved;
      await renameDuringRequest?.();
      return saved;
    },
    deleteRemoteAsset: async (_id: string, revision: number) => {
      if (unavailable) throw new TypeError('Failed to fetch');
      if (blocked) throw inUse();
      if (remote && remote.revision !== revision) throw conflict();
      remote = null;
    },
  };
  const server = await createTemplateTestServer([{
    name: 'asset-sync-transport',
    load(id) {
      if (id.endsWith('/src/apis/supabase/templates.ts')) return [
        'listRemoteAssets', 'getRemoteAsset', 'downloadRemoteAsset', 'uploadRemoteAsset', 'putRemoteAsset', 'deleteRemoteAsset',
      ].map(name => `export const ${name} = (...args) => globalThis.assetSyncTest.${name}(...args);`).join('\n');
    },
  }]);
  try {
    const repository = await server.ssrLoadModule('/src/storage/templates/assetRepository.ts') as typeof import('../../src/storage/templates/assetRepository.ts');
    const sync = await server.ssrLoadModule('/src/sync/assetSync.ts') as typeof import('../../src/sync/assetSync.ts');
    const outbox = await server.ssrLoadModule('/src/storage/account/syncRepository.ts') as typeof import('../../src/storage/account/syncRepository.ts');
    const { getLinkuDb } = await server.ssrLoadModule('/src/storage/indexedDb/linkuDatabase.ts') as typeof import('../../src/storage/indexedDb/linkuDatabase.ts');
    const { SyncConflictError } = await server.ssrLoadModule('/src/apis/supabase/errors.ts');
    const { UserFacingError } = await server.ssrLoadModule('/src/errors/userFacingError.ts');
    conflict = () => new SyncConflictError();
    inUse = () => new UserFacingError('다른 기기에서 사용 중', 'ASSET_IN_USE');
    const database = await getLinkuDb();
    const key = outbox.syncMetadataKey('account', 'asset', asset.id);
    const prepare = async () => {
      for (const store of ['assets', 'templates', 'drafts', 'outbox', 'syncMeta', 'settings'] as const) await database.clear(store);
      await database.put('assets', asset);
      await outbox.activateSyncAccount('account');
      await database.clear('outbox');
      await database.put('syncMeta', { key, revision: 1, contentHash: asset.id });
      remote = { contentHash: asset.id, name: asset.name, revision: 1, objectPath: 'account/image.webp' };
      unavailable = false; blocked = false; renameDuringRequest = undefined;
    };
    const pending = async () => (await outbox.listSyncOutbox())[0];

    await t.test('이름 변경은 blob과 ID를 유지하고 offline 후 재시도한다', async () => {
      await prepare();
      const renamed = await repository.renameAsset(asset.numericId, ' 새 이름 ');
      assert.equal(renamed.id, asset.id);
      assert.equal(await renamed.blob.text(), await asset.blob.text());
      unavailable = true;
      await assert.rejects(sync.pushAsset(await pending(), 'account'));
      assert.equal((await pending()).operation, 'put');
      unavailable = false;
      await sync.pushAsset(await pending(), 'account');
      assert.equal(remote?.name, '새 이름');
      assert.equal(uploads, 0);
      assert.equal((await outbox.listSyncOutbox()).length, 0);
    });
    await t.test('다른 기기의 이름을 이미지 다운로드 없이 반영한다', async () => {
      await prepare();
      remote = { ...remote!, name: '다른 기기', revision: 2 };
      assert.equal(await sync.pullAssets('account'), 1);
      assert.equal((await repository.listAssets())[0].name, '다른 기기');
      assert.equal(await sync.pullAssets('account'), 0);
    });
    await t.test('이전 응답이 도중에 저장한 새 이름을 덮지 않는다', async () => {
      await prepare();
      await repository.renameAsset(asset.numericId, '첫 변경');
      renameDuringRequest = async () => { await repository.renameAsset(asset.numericId, '최신 변경'); };
      await sync.pushAsset(await pending(), 'account');
      assert.equal((await repository.listAssets())[0].name, '최신 변경');
      assert.equal((await outbox.getSyncMetadata(key))?.revision, 2);
      renameDuringRequest = undefined;
      await sync.pushAsset(await pending(), 'account');
      assert.equal(remote?.name, '최신 변경');
    });
    await t.test('사용 중인 로컬 템플릿과 draft의 아이콘은 삭제하지 않는다', async () => {
      await prepare();
      const stored = { template: { items: [] }, stagingItems: [{ icon: { iconId: asset.numericId, iconUrl: asset.dataUrl } }] } as StoredTemplate;
      for (const store of ['templates', 'drafts'] as const) {
        if (store === 'templates') await database.put('templates', stored, 1);
        else await database.put('drafts', stored, 'current');
        await assert.rejects(repository.deleteAsset(asset.numericId), { code: 'ASSET_IN_USE' });
        await database.clear(store);
      }
      assert.equal((await repository.listAssets()).length, 1);
    });
    await t.test('오프라인 삭제는 숨기고 큐에 남긴 뒤 재연결 때 blob까지 지운다', async () => {
      await prepare();
      await repository.deleteAsset(asset.numericId);
      assert.equal((await repository.listAssets()).length, 0);
      unavailable = true;
      await assert.rejects(sync.pushAsset(await pending(), 'account'));
      assert.equal((await pending()).operation, 'delete');
      await sync.pullAssets('account');
      assert.equal((await repository.listAssets()).length, 0);
      unavailable = false;
      await sync.pushAsset(await pending(), 'account');
      assert.equal(await repository.getAssetById(asset.id), undefined);
      assert.equal((await outbox.getSyncMetadata(key))?.deleted, true);
    });
    await t.test('서버 참조 검증이 거부한 삭제는 아이콘을 복구하고 설명을 반환한다', async () => {
      await prepare();
      await repository.deleteAsset(asset.numericId);
      blocked = true;
      assert.deepEqual(await sync.pushAsset(await pending(), 'account'), { conflict: true, blocked: '다른 기기에서 사용 중' });
      assert.equal((await repository.listAssets()).length, 1);
      assert.equal((await outbox.listSyncOutbox()).length, 0);
    });
    await t.test('다른 기기에서 삭제한 아이콘은 pending rename으로 재생성되지 않는다', async () => {
      await prepare();
      await repository.renameAsset(asset.numericId, '오프라인 이름');
      remote = null;
      await sync.pullAssets('account');
      assert.equal((await pending()).operation, 'put');
      assert.equal((await sync.pushAsset(await pending(), 'account')).conflict, true);
      assert.equal((await repository.listAssets()).length, 0);
      assert.equal((await outbox.getSyncMetadata(key))?.deleted, true);
      assert.equal(uploads, 0);
    });
    await t.test('참조가 남은 로컬 원본은 숨긴 상태로 보존하고 동기화에서 재업로드하지 않는다', async () => {
      await prepare();
      await database.put('templates', { template: { items: [{ icon: { iconId: asset.numericId } }] }, stagingItems: [] } as unknown as StoredTemplate, 1);
      remote = null;
      await sync.pullAssets('account');
      assert.equal((await repository.listAssets()).length, 0);
      assert.equal(await (await repository.getAssetById(asset.id))?.blob.text(), 'same image');
      await database.clear('templates');
      await sync.pullAssets('account');
      assert.equal(await repository.getAssetById(asset.id), undefined);
    });
    await t.test('asset 생성 → template 변경 → asset 삭제 순서를 유지한다', () => {
      const entries = [outbox.createSyncOutboxEntry('asset', 'old', 'delete', 1), outbox.createSyncOutboxEntry('template', 't', 'put', 3), outbox.createSyncOutboxEntry('asset', 'new', 'put', 4)];
      assert.deepEqual(entries.sort(sync.compareSyncOperations).map(entry => entry.resourceId), ['new', 't', 'old']);
    });
  } finally {
    await server.close();
    delete scope.assetSyncTest;
  }
});
