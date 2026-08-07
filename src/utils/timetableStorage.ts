import type {
  EverytimeTimetable,
  EverytimeTimetableMeta,
  EverytimeTimetableOverride,
  EverytimeTimetableOverrideIndex,
  EverytimeTimetableOverrideInput,
  ResolvedTimetableAsset,
  SaveTimetableInput,
  TimetableAssetIndex,
  TimetableAssetMeta,
  UploadedTimetableMeta,
} from "@/types/timetable";
import {
  isTimetableImageMimeType,
  TIMETABLE_STORAGE_KEYS,
} from "@/types/timetable";
import { getStorage, removeStorage, setStorage } from "@/utils/chrome";
import {
  createEverytimeTimetableOverride,
  isEverytimeTimetableOverrideEmpty,
  mergeEverytimeTimetable,
} from "@/utils/everytimeTimetable";
import {
  resolveTimetableAssetIndex,
  replaceTimetableAsset,
  type TimetableAssetIndexResolution,
} from "@/utils/timetableStorageSchema";

const DATABASE_NAME = "linku-timetable";
const DATABASE_VERSION = 1;
const ASSET_STORE_NAME = "assets";
const UPLOADED_TIMETABLE_ASSET_PREFIX = "upload:";
const EVERYTIME_TIMETABLE_ASSET_PREFIX = "everytime:";
const TIMETABLE_STORAGE_LOCK_NAME = "linku:timetable-storage";

interface TimetableBlobRecord {
  id: string;
  blob: Blob;
}

let inProcessMutationQueue: Promise<void> = Promise.resolve();

function withInProcessMutationQueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = inProcessMutationQueue.then(operation, operation);
  inProcessMutationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function withTimetableStorageLock<T>(
  operation: () => Promise<T>,
): Promise<T> {
  const lockManager = globalThis.navigator?.locks;
  if (lockManager) {
    return lockManager.request(TIMETABLE_STORAGE_LOCK_NAME, operation);
  }

  return withInProcessMutationQueue(operation);
}

function hasExtensionStorage(): boolean {
  return (
    typeof chrome !== "undefined" &&
    Boolean(chrome.runtime?.id) &&
    Boolean(chrome.storage?.local)
  );
}

async function getTimetableSetting<T>(key: string): Promise<T | undefined> {
  if (hasExtensionStorage()) {
    return getStorage<T>(key);
  }

  const value = localStorage.getItem(key);
  return value ? (JSON.parse(value) as T) : undefined;
}

async function setTimetableSettings(
  data: Record<string, unknown>,
): Promise<void> {
  if (hasExtensionStorage()) {
    return setStorage(data);
  }

  Object.entries(data).forEach(([key, value]) => {
    localStorage.setItem(key, JSON.stringify(value));
  });
}

async function removeTimetableSetting(key: string): Promise<void> {
  if (hasExtensionStorage()) {
    return removeStorage(key);
  }

  localStorage.removeItem(key);
}

async function readTimetableAssetIndexResolution(): Promise<
  TimetableAssetIndexResolution
> {
  const [storedIndex, storedLegacyMeta] = await Promise.all([
    getTimetableSetting<unknown>(TIMETABLE_STORAGE_KEYS.assetIndex),
    getTimetableSetting<unknown>(TIMETABLE_STORAGE_KEYS.legacyMeta),
  ]);
  return resolveTimetableAssetIndex(storedIndex, storedLegacyMeta);
}

async function getTimetableAssetIndexUnlocked(): Promise<TimetableAssetIndex> {
  const resolution = await readTimetableAssetIndexResolution();
  if (resolution.shouldPersist) {
    await setTimetableAssetIndex(resolution.index);
  }
  if (resolution.shouldRemoveLegacyMeta) {
    await removeTimetableSetting(TIMETABLE_STORAGE_KEYS.legacyMeta);
  }
  return resolution.index;
}

async function getTimetableAssetIndex(): Promise<TimetableAssetIndex> {
  const resolution = await readTimetableAssetIndexResolution();
  if (!resolution.shouldPersist && !resolution.shouldRemoveLegacyMeta) {
    return resolution.index;
  }

  return withTimetableStorageLock(getTimetableAssetIndexUnlocked);
}

async function setTimetableAssetIndex(
  index: TimetableAssetIndex,
): Promise<void> {
  await setTimetableSettings({
    [TIMETABLE_STORAGE_KEYS.assetIndex]: index,
  });
}

function createEmptyOverrideIndex(): EverytimeTimetableOverrideIndex {
  return {
    schemaVersion: 1,
    overrides: {},
  };
}

function isEverytimeTimetableOverrideIndex(
  value: unknown,
): value is EverytimeTimetableOverrideIndex {
  return (
    typeof value === "object" &&
    value !== null &&
    "schemaVersion" in value &&
    value.schemaVersion === 1 &&
    "overrides" in value &&
    typeof value.overrides === "object" &&
    value.overrides !== null
  );
}

async function getEverytimeTimetableOverrideIndex(): Promise<
  EverytimeTimetableOverrideIndex
> {
  const storedIndex = await getTimetableSetting<unknown>(
    TIMETABLE_STORAGE_KEYS.everytimeOverrides,
  );
  return isEverytimeTimetableOverrideIndex(storedIndex)
    ? storedIndex
    : createEmptyOverrideIndex();
}

async function setEverytimeTimetableOverrideIndex(
  index: EverytimeTimetableOverrideIndex,
): Promise<void> {
  await setTimetableSettings({
    [TIMETABLE_STORAGE_KEYS.everytimeOverrides]: index,
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    let blocked = false;

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(ASSET_STORE_NAME)) {
        database.createObjectStore(ASSET_STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => {
      if (blocked) {
        request.result.close();
        return;
      }
      resolve(request.result);
    };
    request.onerror = () =>
      reject(request.error ?? new Error("시간표 저장소를 열 수 없습니다."));
    request.onblocked = () => {
      blocked = true;
      reject(
        new Error(
          "다른 시간표 화면이 저장소를 사용 중입니다. 창을 닫고 다시 시도해주세요.",
        ),
      );
    };
  });
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDatabase().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        const transaction = database.transaction(ASSET_STORE_NAME, mode);
        const store = transaction.objectStore(ASSET_STORE_NAME);
        const request = operation(store);
        let result: T;
        let settled = false;

        const fail = (error?: DOMException | null): void => {
          if (settled) {
            return;
          }
          settled = true;
          database.close();
          reject(error ?? new Error("시간표 저장에 실패했습니다."));
        };

        request.onsuccess = () => {
          result = request.result;
        };
        request.onerror = () => fail(request.error);
        transaction.oncomplete = () => {
          if (settled) {
            return;
          }
          settled = true;
          database.close();
          resolve(result);
        };
        transaction.onerror = () => fail(transaction.error);
        transaction.onabort = () => fail(transaction.error);
      }),
  );
}

async function calculateChecksum(value: Blob | string): Promise<string> {
  const buffer =
    typeof value === "string"
      ? new TextEncoder().encode(value)
      : await value.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function getAssetId(input: SaveTimetableInput, checksum: string): string {
  return input.id ?? `${UPLOADED_TIMETABLE_ASSET_PREFIX}${checksum}`;
}

function assertUniqueAddedIds(
  label: string,
  sourceIds: Set<string>,
  addedIds: string[],
): void {
  const seenIds = new Set<string>();
  const conflictingId = addedIds.find((id) => {
    if (sourceIds.has(id) || seenIds.has(id)) {
      return true;
    }

    seenIds.add(id);
    return false;
  });

  if (conflictingId) {
    throw new Error(`${label} ID가 원본 또는 다른 사용자 추가 항목과 겹칩니다.`);
  }
}

function validateOverrideAdditions(
  snapshot: EverytimeTimetable,
  input: EverytimeTimetableOverrideInput,
): void {
  assertUniqueAddedIds(
    "사용자 추가 과목",
    new Set((snapshot.courses ?? []).map((course) => course.id)),
    (input.addedCourses ?? []).map((course) => course.id),
  );
  assertUniqueAddedIds(
    "사용자 추가 수업",
    new Set(snapshot.subjects.map((subject) => subject.id)),
    (input.addedSubjects ?? []).map((subject) => subject.id),
  );
}

export function getEverytimeTimetableAssetId(semester: string): string {
  return `${EVERYTIME_TIMETABLE_ASSET_PREFIX}${semester}`;
}

export async function saveTimetableAsset(
  blob: Blob,
  input: SaveTimetableInput,
): Promise<{ meta: UploadedTimetableMeta; changed: boolean }> {
  const mimeType = blob.type;
  if (!isTimetableImageMimeType(mimeType)) {
    throw new Error("지원하지 않는 이미지 형식입니다.");
  }

  const checksum = await calculateChecksum(blob);
  const id = getAssetId(input, checksum);

  return withTimetableStorageLock(async () => {
    const index = await getTimetableAssetIndexUnlocked();
    const previousMeta = index.assets.find(
      (asset): asset is UploadedTimetableMeta =>
        asset.id === id && asset.source === "upload",
    );
    const previousRecord = await runTransaction<
      TimetableBlobRecord | undefined
    >("readonly", (store) => store.get(id));

    if (previousMeta?.checksum === checksum && previousRecord?.blob) {
      if (index.activeAssetId !== id) {
        await setTimetableAssetIndex(
          replaceTimetableAsset(index, previousMeta, true),
        );
      }
      return { meta: previousMeta, changed: false };
    }

    const now = new Date().toISOString();
    const meta: UploadedTimetableMeta = {
      schemaVersion: 3,
      id,
      source: "upload",
      mimeType,
      width: input.width,
      height: input.height,
      byteSize: blob.size,
      checksum,
      syncStatus: "local",
      createdAt: previousMeta?.createdAt ?? now,
      updatedAt: now,
    };

    await runTransaction<IDBValidKey>("readwrite", (store) =>
      store.put({ id, blob } satisfies TimetableBlobRecord),
    );

    try {
      await setTimetableAssetIndex(replaceTimetableAsset(index, meta, true));
    } catch (error) {
      if (previousRecord) {
        await runTransaction<IDBValidKey>("readwrite", (store) =>
          store.put(previousRecord),
        );
      } else {
        await runTransaction<undefined>("readwrite", (store) =>
          store.delete(id),
        );
      }
      throw error;
    }

    return { meta, changed: true };
  });
}

export async function saveEverytimeTimetable(
  snapshot: EverytimeTimetable,
): Promise<{ meta: EverytimeTimetableMeta; changed: boolean }> {
  const id = getEverytimeTimetableAssetId(snapshot.semester);
  const snapshotChecksum = await calculateChecksum(JSON.stringify(snapshot));

  return withTimetableStorageLock(async () => {
    const index = await getTimetableAssetIndexUnlocked();
    const previousMeta = index.assets.find(
      (asset): asset is EverytimeTimetableMeta =>
        asset.id === id && asset.source === "everytime",
    );

    if (previousMeta?.snapshotChecksum === snapshotChecksum) {
      return { meta: previousMeta, changed: false };
    }

    const now = new Date().toISOString();
    const meta: EverytimeTimetableMeta = {
      schemaVersion: 3,
      id,
      source: "everytime",
      semester: snapshot.semester,
      snapshot,
      snapshotChecksum,
      syncStatus: "local",
      createdAt: previousMeta?.createdAt ?? now,
      updatedAt: now,
    };

    await setTimetableAssetIndex(replaceTimetableAsset(index, meta, false));
    return { meta, changed: true };
  });
}

export async function getEverytimeTimetableOverride(
  assetId: string,
): Promise<EverytimeTimetableOverride | null> {
  const index = await getEverytimeTimetableOverrideIndex();
  return index.overrides[assetId] ?? null;
}

export async function saveEverytimeTimetableOverride(
  assetId: string,
  input: EverytimeTimetableOverrideInput,
): Promise<EverytimeTimetableOverride | null> {
  return withTimetableStorageLock(async () => {
    const assetIndex = await getTimetableAssetIndexUnlocked();
    const asset = assetIndex.assets.find((candidate) => candidate.id === assetId);
    if (asset?.source !== "everytime") {
      throw new Error("사용자 수정을 저장할 에브리타임 시간표를 찾지 못했습니다.");
    }
    validateOverrideAdditions(asset.snapshot, input);

    const overrideIndex = await getEverytimeTimetableOverrideIndex();
    const override = createEverytimeTimetableOverride(assetId, input);
    const overrides = { ...overrideIndex.overrides };

    if (isEverytimeTimetableOverrideEmpty(override)) {
      delete overrides[assetId];
    } else {
      overrides[assetId] = override;
    }

    await setEverytimeTimetableOverrideIndex({
      schemaVersion: 1,
      overrides,
    });
    return overrides[assetId] ?? null;
  });
}

export async function clearEverytimeTimetableOverride(
  assetId: string,
): Promise<void> {
  await withTimetableStorageLock(async () => {
    const overrideIndex = await getEverytimeTimetableOverrideIndex();
    if (!overrideIndex.overrides[assetId]) {
      return;
    }

    const overrides = { ...overrideIndex.overrides };
    delete overrides[assetId];
    await setEverytimeTimetableOverrideIndex({
      schemaVersion: 1,
      overrides,
    });
  });
}

export async function getTimetableAssets(): Promise<TimetableAssetMeta[]> {
  const index = await getTimetableAssetIndex();
  return index.assets;
}

export async function getActiveTimetable(): Promise<
  ResolvedTimetableAsset | null
> {
  const index = await getTimetableAssetIndex();
  const meta = index.assets.find((asset) => asset.id === index.activeAssetId);
  if (!meta) {
    return null;
  }

  if (meta.source === "everytime") {
    const override = await getEverytimeTimetableOverride(meta.id);
    return {
      kind: "everytime",
      meta,
      override,
      timetable: mergeEverytimeTimetable(meta.snapshot, override ?? undefined),
    };
  }

  const record = await runTransaction<TimetableBlobRecord | undefined>(
    "readonly",
    (store) => store.get(meta.id),
  );

  if (!record?.blob) {
    await withTimetableStorageLock(async () => {
      const latestIndex = await getTimetableAssetIndexUnlocked();
      const assets = latestIndex.assets.filter((asset) => asset.id !== meta.id);
      await setTimetableAssetIndex({
        schemaVersion: 3,
        activeAssetId:
          latestIndex.activeAssetId === meta.id
            ? (assets[0]?.id ?? null)
            : latestIndex.activeAssetId,
        assets,
      });
    });
    return null;
  }

  return { kind: "upload", meta, blob: record.blob };
}

export async function setActiveTimetable(id: string): Promise<void> {
  await withTimetableStorageLock(async () => {
    const index = await getTimetableAssetIndexUnlocked();
    const asset = index.assets.find((stored) => stored.id === id);
    if (!asset) {
      throw new Error("저장된 시간표를 찾지 못했습니다.");
    }

    await setTimetableAssetIndex(replaceTimetableAsset(index, asset, true));
  });
}

async function deleteTimetableByIdUnlocked(id: string): Promise<void> {
  const index = await getTimetableAssetIndexUnlocked();
  const asset = index.assets.find((stored) => stored.id === id);
  if (!asset) {
    return;
  }

  let uploadedRecord: TimetableBlobRecord | undefined;
  if (asset.source === "upload") {
    uploadedRecord = await runTransaction<TimetableBlobRecord | undefined>(
      "readonly",
      (store) => store.get(id),
    );
    await runTransaction<undefined>("readwrite", (store) => store.delete(id));
  }

  const assets = index.assets.filter((stored) => stored.id !== id);
  const nextAssetIndex: TimetableAssetIndex = {
    schemaVersion: 3,
    activeAssetId:
      index.activeAssetId === id
        ? (assets[0]?.id ?? null)
        : index.activeAssetId,
    assets,
  };

  if (asset.source === "everytime") {
    const overrideIndex = await getEverytimeTimetableOverrideIndex();
    const overrides = { ...overrideIndex.overrides };
    delete overrides[id];
    await setTimetableSettings({
      [TIMETABLE_STORAGE_KEYS.assetIndex]: nextAssetIndex,
      [TIMETABLE_STORAGE_KEYS.everytimeOverrides]: {
        schemaVersion: 1,
        overrides,
      } satisfies EverytimeTimetableOverrideIndex,
    });
    return;
  }

  try {
    await setTimetableAssetIndex(nextAssetIndex);
  } catch (error) {
    if (uploadedRecord) {
      await runTransaction<IDBValidKey>("readwrite", (store) =>
        store.put(uploadedRecord),
      );
    }
    throw error;
  }
}

export async function deleteActiveTimetable(): Promise<void> {
  await withTimetableStorageLock(async () => {
    const index = await getTimetableAssetIndexUnlocked();
    if (index.activeAssetId) {
      await deleteTimetableByIdUnlocked(index.activeAssetId);
    }
  });
}

export async function getImportedEverytimeSemesters(): Promise<string[]> {
  return (
    (await getTimetableSetting<string[]>(
      TIMETABLE_STORAGE_KEYS.everytimeImportedSemesters,
    )) ?? []
  );
}

export async function markEverytimeSemestersImported(
  semesters: string[],
): Promise<void> {
  await withTimetableStorageLock(async () => {
    const importedSemesters = await getImportedEverytimeSemesters();
    await setTimetableSettings({
      [TIMETABLE_STORAGE_KEYS.everytimeImportedSemesters]: [
        ...new Set([...importedSemesters, ...semesters]),
      ],
    });
  });
}
