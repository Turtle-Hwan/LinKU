import assert from "node:assert/strict";
import test from "node:test";
import {
  createEmptyTimetableAssetIndex,
  replaceTimetableAsset,
  resolveTimetableAssetIndex,
} from "../../src/utils/timetableStorageSchema.ts";

const NOW = "2026-08-05T00:00:00.000Z";

function createUpload(id: string, checksum = id) {
  return {
    schemaVersion: 3 as const,
    id,
    source: "upload" as const,
    mimeType: "image/png" as const,
    width: 1200,
    height: 800,
    byteSize: 1024,
    checksum,
    syncStatus: "local" as const,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

test("서로 다른 업로드 이미지를 collection에 보존하고 같은 ID만 교체한다", () => {
  const first = createUpload("upload:first");
  const second = createUpload("upload:second");
  const updatedFirst = createUpload("upload:first", "changed");

  const withFirst = replaceTimetableAsset(
    createEmptyTimetableAssetIndex(),
    first,
    true,
  );
  const withSecond = replaceTimetableAsset(withFirst, second, true);
  const updated = replaceTimetableAsset(withSecond, updatedFirst, false);

  assert.equal(withSecond.activeAssetId, second.id);
  assert.deepEqual(
    updated.assets.map((asset) => asset.id),
    [first.id, second.id],
  );
  assert.equal(updated.assets[0].source === "upload" && updated.assets[0].checksum, "changed");
});

test("schema v2 에브리타임 timetable을 v3 snapshot으로 이관한다", () => {
  const resolution = resolveTimetableAssetIndex({
    schemaVersion: 2,
    activeAssetId: "everytime:2025년 2학기",
    assets: [
      {
        schemaVersion: 2,
        id: "everytime:2025년 2학기",
        source: "everytime",
        semester: "2025년 2학기",
        timetable: {
          semester: "2025년 2학기",
          weekdays: ["월", "화", "수", "목", "금"],
          slotCount: 48,
          subjects: [],
        },
        checksum: "snapshot-checksum",
        syncStatus: "local",
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
  });

  assert.equal(resolution.shouldPersist, true);
  assert.equal(resolution.index.schemaVersion, 3);
  const asset = resolution.index.assets[0];
  assert.equal(asset.source, "everytime");
  assert.equal(
    asset.source === "everytime" && asset.snapshot.semester,
    "2025년 2학기",
  );
});

test("legacy 단일 이미지 메타를 이관하고 손상된 v3 index는 비운다", () => {
  const migrated = resolveTimetableAssetIndex(undefined, {
    id: "legacy",
    source: "upload",
    mimeType: "image/png",
    width: 1200,
    height: 800,
    byteSize: 1024,
    checksum: "legacy",
    syncStatus: "local",
    createdAt: NOW,
    updatedAt: NOW,
  });
  assert.equal(migrated.index.assets[0]?.source, "upload");
  assert.equal(migrated.shouldRemoveLegacyMeta, true);

  const corrupted = resolveTimetableAssetIndex({
    schemaVersion: 3,
    activeAssetId: "broken",
    assets: [{ id: "broken" }],
  });
  assert.deepEqual(corrupted.index, createEmptyTimetableAssetIndex());
});
