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
import { TIMETABLE_STORAGE_KEYS } from "@/types/timetable";
import { getStorage, removeStorage, setStorage } from "@/utils/chrome";
import {
  createEverytimeTimetableOverride,
  isEverytimeTimetableOverrideEmpty,
  mergeEverytimeTimetable,
} from "@/utils/everytimeTimetable";

const DATABASE_NAME = "linku-timetable";
const DATABASE_VERSION = 1;
const ASSET_STORE_NAME = "assets";
const UPLOADED_TIMETABLE_ASSET_ID = "uploaded";
const EVERYTIME_TIMETABLE_ASSET_PREFIX = "everytime:";

interface TimetableBlobRecord {
  id: string;
  blob: Blob;
}

interface LegacyTimetableAssetMeta {
  id: string;
  source: "upload" | "everytime-capture";
  semester?: string;
  mimeType: "image/png";
  width: number;
  height: number;
  byteSize: number;
  checksum: string;
  syncStatus: "local" | "pending" | "synced" | "error";
  createdAt: string;
  updatedAt: string;
}

interface LegacyTimetableAssetIndex {
  schemaVersion: 1;
  activeAssetId: string | null;
  assets: LegacyTimetableAssetMeta[];
}

interface LegacyV2TimetableMetaBase {
  schemaVersion: 2;
  id: string;
  source: "upload" | "everytime";
  semester?: string;
  syncStatus: "local" | "pending" | "synced" | "error";
  createdAt: string;
  updatedAt: string;
}

interface LegacyV2UploadedTimetableMeta extends LegacyV2TimetableMetaBase {
  source: "upload";
  mimeType: "image/png";
  width: number;
  height: number;
  byteSize: number;
  checksum: string;
}

interface LegacyV2EverytimeTimetableMeta extends LegacyV2TimetableMetaBase {
  source: "everytime";
  timetable: EverytimeTimetable;
  checksum: string;
}

type LegacyV2TimetableAssetMeta =
  | LegacyV2UploadedTimetableMeta
  | LegacyV2EverytimeTimetableMeta;

interface LegacyV2TimetableAssetIndex {
  schemaVersion: 2;
  activeAssetId: string | null;
  assets: LegacyV2TimetableAssetMeta[];
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

function isTimetableAssetIndex(value: unknown): value is TimetableAssetIndex {
  return (
    typeof value === "object" &&
    value !== null &&
    "schemaVersion" in value &&
    value.schemaVersion === 3 &&
    "assets" in value &&
    Array.isArray(value.assets)
  );
}

function isLegacyV2TimetableAssetIndex(
  value: unknown,
): value is LegacyV2TimetableAssetIndex {
  return (
    typeof value === "object" &&
    value !== null &&
    "schemaVersion" in value &&
    value.schemaVersion === 2 &&
    "assets" in value &&
    Array.isArray(value.assets)
  );
}

function isLegacyTimetableAssetIndex(
  value: unknown,
): value is LegacyTimetableAssetIndex {
  return (
    typeof value === "object" &&
    value !== null &&
    "schemaVersion" in value &&
    value.schemaVersion === 1 &&
    "assets" in value &&
    Array.isArray(value.assets)
  );
}

function createEmptyAssetIndex(): TimetableAssetIndex {
  return {
    schemaVersion: 3,
    activeAssetId: null,
    assets: [],
  };
}

function migrateLegacyAsset(
  legacy: LegacyTimetableAssetMeta,
): UploadedTimetableMeta {
  return {
    schemaVersion: 3,
    id: legacy.id,
    source: "upload",
    mimeType: "image/png",
    width: legacy.width,
    height: legacy.height,
    byteSize: legacy.byteSize,
    checksum: legacy.checksum,
    syncStatus: legacy.syncStatus,
    createdAt: legacy.createdAt,
    updatedAt: legacy.updatedAt,
  };
}

function migrateV2Asset(
  legacy: LegacyV2TimetableAssetMeta,
): TimetableAssetMeta {
  if (legacy.source === "everytime") {
    return {
      schemaVersion: 3,
      id: legacy.id,
      source: "everytime",
      semester: legacy.semester,
      snapshot: legacy.timetable,
      snapshotChecksum: legacy.checksum,
      syncStatus: legacy.syncStatus,
      createdAt: legacy.createdAt,
      updatedAt: legacy.updatedAt,
    };
  }

  return {
    ...legacy,
    schemaVersion: 3,
  };
}

async function getTimetableAssetIndex(): Promise<TimetableAssetIndex> {
  const storedIndex = await getTimetableSetting<unknown>(
    TIMETABLE_STORAGE_KEYS.assetIndex,
  );
  if (isTimetableAssetIndex(storedIndex)) {
    return storedIndex;
  }

  if (isLegacyV2TimetableAssetIndex(storedIndex)) {
    const migratedIndex: TimetableAssetIndex = {
      schemaVersion: 3,
      activeAssetId: storedIndex.activeAssetId,
      assets: storedIndex.assets.map(migrateV2Asset),
    };
    await setTimetableAssetIndex(migratedIndex);
    return migratedIndex;
  }

  const legacyIndex = isLegacyTimetableAssetIndex(storedIndex)
    ? storedIndex
    : undefined;
  const legacyMeta = legacyIndex
    ? undefined
    : await getTimetableSetting<LegacyTimetableAssetMeta>(
        TIMETABLE_STORAGE_KEYS.legacyMeta,
      );
  const legacyAssets = legacyIndex?.assets ?? (legacyMeta ? [legacyMeta] : []);

  if (legacyAssets.length === 0) {
    return createEmptyAssetIndex();
  }

  const migratedIndex: TimetableAssetIndex = {
    schemaVersion: 3,
    activeAssetId: legacyIndex?.activeAssetId ?? legacyMeta?.id ?? null,
    assets: legacyAssets.map(migrateLegacyAsset),
  };

  await setTimetableSettings({
    [TIMETABLE_STORAGE_KEYS.assetIndex]: migratedIndex,
  });
  await removeTimetableSetting(TIMETABLE_STORAGE_KEYS.legacyMeta);

  return migratedIndex;
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

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(ASSET_STORE_NAME)) {
        database.createObjectStore(ASSET_STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("시간표 저장소를 열 수 없습니다."));
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

        request.onsuccess = () => {
          result = request.result;
        };
        request.onerror = () => {
          database.close();
          reject(request.error ?? new Error("시간표 저장에 실패했습니다."));
        };
        transaction.oncomplete = () => {
          database.close();
          resolve(result);
        };
        transaction.onerror = () => {
          database.close();
          reject(
            transaction.error ?? new Error("시간표 저장에 실패했습니다."),
          );
        };
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

function getAssetId(input: SaveTimetableInput): string {
  return input.id ?? UPLOADED_TIMETABLE_ASSET_ID;
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

function replaceAsset(
  index: TimetableAssetIndex,
  asset: TimetableAssetMeta,
  activate: boolean,
): TimetableAssetIndex {
  return {
    schemaVersion: 3,
    activeAssetId:
      activate || !index.activeAssetId ? asset.id : index.activeAssetId,
    assets: [asset, ...index.assets.filter((stored) => stored.id !== asset.id)],
  };
}

export function getEverytimeTimetableAssetId(semester: string): string {
  return `${EVERYTIME_TIMETABLE_ASSET_PREFIX}${semester}`;
}

export async function saveTimetableAsset(
  blob: Blob,
  input: SaveTimetableInput,
): Promise<{ meta: UploadedTimetableMeta; changed: boolean }> {
  if (blob.type !== "image/png") {
    throw new Error("PNG 파일만 저장할 수 있습니다.");
  }

  const id = getAssetId(input);
  const checksum = await calculateChecksum(blob);
  const index = await getTimetableAssetIndex();
  const previousMeta = index.assets.find(
    (asset): asset is UploadedTimetableMeta =>
      asset.id === id && asset.source === "upload",
  );

  if (previousMeta?.checksum === checksum) {
    const existingRecord = await runTransaction<
      TimetableBlobRecord | undefined
    >("readonly", (store) => store.get(id));

    if (existingRecord?.blob) {
      if (index.activeAssetId !== id) {
        await setTimetableAssetIndex(replaceAsset(index, previousMeta, true));
      }
      return { meta: previousMeta, changed: false };
    }
  }

  const now = new Date().toISOString();
  const meta: UploadedTimetableMeta = {
    schemaVersion: 3,
    id,
    source: "upload",
    mimeType: "image/png",
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
    await setTimetableAssetIndex(replaceAsset(index, meta, true));
  } catch (error) {
    await runTransaction<undefined>("readwrite", (store) => store.delete(id));
    throw error;
  }

  return { meta, changed: true };
}

export async function saveEverytimeTimetable(
  snapshot: EverytimeTimetable,
): Promise<{ meta: EverytimeTimetableMeta; changed: boolean }> {
  const id = getEverytimeTimetableAssetId(snapshot.semester);
  const snapshotChecksum = await calculateChecksum(JSON.stringify(snapshot));
  const index = await getTimetableAssetIndex();
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

  await setTimetableAssetIndex(replaceAsset(index, meta, false));
  return { meta, changed: true };
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
  const assetIndex = await getTimetableAssetIndex();
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
}

export async function clearEverytimeTimetableOverride(
  assetId: string,
): Promise<void> {
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
    const assets = index.assets.filter((asset) => asset.id !== meta.id);
    await setTimetableAssetIndex({
      schemaVersion: 3,
      activeAssetId: assets[0]?.id ?? null,
      assets,
    });
    return null;
  }

  return { kind: "upload", meta, blob: record.blob };
}

export async function setActiveTimetable(id: string): Promise<void> {
  const index = await getTimetableAssetIndex();
  const asset = index.assets.find((stored) => stored.id === id);
  if (!asset) {
    throw new Error("저장된 시간표를 찾지 못했습니다.");
  }

  await setTimetableAssetIndex(replaceAsset(index, asset, true));
}

async function deleteTimetableById(id: string): Promise<void> {
  const index = await getTimetableAssetIndex();
  const asset = index.assets.find((stored) => stored.id === id);
  if (!asset) {
    return;
  }

  if (asset.source === "upload") {
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

  await setTimetableAssetIndex(nextAssetIndex);
}

export async function deleteActiveTimetable(): Promise<void> {
  const index = await getTimetableAssetIndex();
  if (index.activeAssetId) {
    await deleteTimetableById(index.activeAssetId);
  }
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
  const importedSemesters = await getImportedEverytimeSemesters();
  await setTimetableSettings({
    [TIMETABLE_STORAGE_KEYS.everytimeImportedSemesters]: [
      ...new Set([...importedSemesters, ...semesters]),
    ],
  });
}
