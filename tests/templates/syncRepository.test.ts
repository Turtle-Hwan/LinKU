import assert from "node:assert/strict";
import test from "node:test";
import "fake-indexeddb/auto";

import {
  completeSyncOperation,
  createSyncOutboxEntry,
  getTemplateAccountStates,
  isSyncOutboxEntryCurrent,
  markSyncAttempt,
  replacePublicationMetadata,
  resetSyncConnection,
} from "../../src/storage/account/syncRepository.ts";
import { getLinkuDb } from "../../src/storage/indexedDb/linkuDatabase.ts";

test("이전 동기화 완료가 더 최신 outbox 작업을 지우지 않는다", async () => {
  const database = await getLinkuDb();
  await database.clear("outbox");
  await database.clear("syncMeta");

  const resourceId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const previous = createSyncOutboxEntry("template", resourceId, "put", 1);
  const current = createSyncOutboxEntry("template", resourceId, "delete", 1);
  assert.notEqual(previous.generation, current.generation);

  await database.put("outbox", previous);
  await database.put("outbox", current);
  assert.equal(await isSyncOutboxEntryCurrent(previous), false);
  assert.equal(await isSyncOutboxEntryCurrent(current), true);
  await completeSyncOperation(previous, {
    key: `account:template:${resourceId}`,
    revision: 2,
  });

  assert.deepEqual(await database.get("outbox", current.key), current);
  assert.equal(
    (await database.get("syncMeta", `account:template:${resourceId}`))?.revision,
    2,
  );

  await markSyncAttempt(
    previous,
    `account:template:${resourceId}`,
    "이전 요청 실패",
  );
  assert.equal((await database.get("outbox", current.key))?.attempts, 0);
  assert.equal(
    (await database.get("syncMeta", `account:template:${resourceId}`))?.lastError,
    undefined,
  );

  await completeSyncOperation(current, {
    key: `account:template:${resourceId}`,
    revision: 3,
  });
  assert.equal(await database.get("outbox", current.key), undefined);
  assert.equal(await isSyncOutboxEntryCurrent(current), false);
});

test("서버에서 사라진 게시물의 로컬 게시 상태를 해제한다", async () => {
  const database = await getLinkuDb();
  await database.clear("syncMeta");

  const accountId = "account";
  await database.put("syncMeta", {
    key: `${accountId}:template:published-template`,
    publicationRevision: 2,
    publishedContentHash: "a".repeat(64),
    isPublished: true,
  });
  await database.put("syncMeta", {
    key: `${accountId}:template:missing-template`,
    publicationRevision: 1,
    publishedContentHash: "b".repeat(64),
    isPublished: true,
  });

  await replacePublicationMetadata(accountId, [
    {
      templateId: "published-template",
      revision: 3,
      contentHash: "c".repeat(64),
      isPublished: true,
    },
  ]);

  assert.deepEqual(
    await database.get("syncMeta", `${accountId}:template:published-template`),
    {
      key: `${accountId}:template:published-template`,
      publicationRevision: 3,
      publishedContentHash: "c".repeat(64),
      isPublished: true,
    },
  );
  assert.deepEqual(
    await database.get("syncMeta", `${accountId}:template:missing-template`),
    {
      key: `${accountId}:template:missing-template`,
      publicationRevision: undefined,
      publishedContentHash: undefined,
      isPublished: false,
    },
  );
});

test("템플릿 목록의 동기화 상태를 IndexedDB 한 번의 snapshot으로 읽는다", async () => {
  const database = await getLinkuDb();
  await database.clear("outbox");
  await database.clear("syncMeta");
  await database.put("settings", {
    key: "active-sync-account",
    value: "account",
  });
  await database.put("syncMeta", {
    key: "account:template:synced-template",
    revision: 2,
    isPublished: true,
    publishedContentHash: "a".repeat(64),
  });
  await database.put(
    "outbox",
    createSyncOutboxEntry("template", "pending-template", "put"),
  );

  const states = await getTemplateAccountStates([
    "synced-template",
    "pending-template",
  ]);

  assert.deepEqual(states.get("synced-template"), {
    status: "synced",
    isPublished: true,
    publishedContentHash: "a".repeat(64),
  });
  assert.deepEqual(states.get("pending-template"), {
    status: "pending",
    isPublished: false,
    publishedContentHash: undefined,
  });

  await resetSyncConnection();
  assert.equal(await database.get("settings", "active-sync-account"), undefined);
  assert.equal(await database.count("outbox"), 0);
  assert.equal(await database.count("syncMeta"), 0);
});
