import type {
  TimetableAssetIndex,
  TimetableAssetMeta,
  UploadedTimetableMeta,
} from "@/types/timetable";
import { isTimetableImageMimeType } from "../types/timetable.ts";

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
  timetable: Extract<TimetableAssetMeta, { source: "everytime" }>["snapshot"];
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

export interface TimetableAssetIndexResolution {
  index: TimetableAssetIndex;
  shouldPersist: boolean;
  shouldRemoveLegacyMeta: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasAssetArray(
  value: unknown,
): value is Record<string, unknown> & { assets: unknown[] } {
  return isRecord(value) && Array.isArray(value.assets);
}

function isTimetableAssetIndex(value: unknown): value is TimetableAssetIndex {
  return (
    hasAssetArray(value) &&
    value.schemaVersion === 3 &&
    (typeof value.activeAssetId === "string" || value.activeAssetId === null) &&
    value.assets.every(isTimetableAssetMeta)
  );
}

function hasTimetableMetaBase(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    value.schemaVersion === 3 &&
    typeof value.id === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string" &&
    (value.syncStatus === "local" ||
      value.syncStatus === "pending" ||
      value.syncStatus === "synced" ||
      value.syncStatus === "error")
  );
}

function isEverytimeTimetableSnapshot(
  value: unknown,
): value is Extract<TimetableAssetMeta, { source: "everytime" }>[
  "snapshot"
] {
  return (
    isRecord(value) &&
    typeof value.semester === "string" &&
    Array.isArray(value.weekdays) &&
    Array.isArray(value.subjects)
  );
}

function isTimetableAssetMeta(value: unknown): value is TimetableAssetMeta {
  if (!hasTimetableMetaBase(value)) {
    return false;
  }

  if (value.source === "upload") {
    return (
      typeof value.mimeType === "string" &&
      isTimetableImageMimeType(value.mimeType) &&
      typeof value.width === "number" &&
      typeof value.height === "number" &&
      typeof value.byteSize === "number" &&
      typeof value.checksum === "string"
    );
  }

  if (value.source !== "everytime") {
    return false;
  }

  return (
    typeof value.snapshotChecksum === "string" &&
    isEverytimeTimetableSnapshot(value.snapshot)
  );
}

function isLegacyV2TimetableAssetIndex(
  value: unknown,
): value is LegacyV2TimetableAssetIndex {
  return (
    hasAssetArray(value) &&
    value.schemaVersion === 2 &&
    (typeof value.activeAssetId === "string" || value.activeAssetId === null) &&
    value.assets.every(isLegacyV2TimetableAssetMeta)
  );
}

function isLegacyTimetableAssetIndex(
  value: unknown,
): value is LegacyTimetableAssetIndex {
  return (
    hasAssetArray(value) &&
    value.schemaVersion === 1 &&
    (typeof value.activeAssetId === "string" || value.activeAssetId === null) &&
    value.assets.every(isLegacyTimetableAssetMeta)
  );
}

function hasLegacyV2TimetableMetaBase(
  value: unknown,
): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    value.schemaVersion === 2 &&
    typeof value.id === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string" &&
    (value.syncStatus === "local" ||
      value.syncStatus === "pending" ||
      value.syncStatus === "synced" ||
      value.syncStatus === "error")
  );
}

function isLegacyV2TimetableAssetMeta(
  value: unknown,
): value is LegacyV2TimetableAssetMeta {
  if (!hasLegacyV2TimetableMetaBase(value)) {
    return false;
  }

  if (value.source === "upload") {
    return (
      value.mimeType === "image/png" &&
      typeof value.width === "number" &&
      typeof value.height === "number" &&
      typeof value.byteSize === "number" &&
      typeof value.checksum === "string"
    );
  }

  return (
    value.source === "everytime" &&
    isEverytimeTimetableSnapshot(value.timetable) &&
    typeof value.checksum === "string"
  );
}

function isLegacyTimetableAssetMeta(
  value: unknown,
): value is LegacyTimetableAssetMeta {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    (value.source === "upload" || value.source === "everytime-capture") &&
    value.mimeType === "image/png" &&
    typeof value.width === "number" &&
    typeof value.height === "number" &&
    typeof value.byteSize === "number" &&
    typeof value.checksum === "string" &&
    (value.syncStatus === "local" ||
      value.syncStatus === "pending" ||
      value.syncStatus === "synced" ||
      value.syncStatus === "error") &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

export function createEmptyTimetableAssetIndex(): TimetableAssetIndex {
  return {
    schemaVersion: 3,
    activeAssetId: null,
    assets: [],
  };
}

export function replaceTimetableAsset(
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

export function resolveTimetableAssetIndex(
  storedIndex: unknown,
  storedLegacyMeta?: unknown,
): TimetableAssetIndexResolution {
  if (isTimetableAssetIndex(storedIndex)) {
    return {
      index: storedIndex,
      shouldPersist: false,
      shouldRemoveLegacyMeta: false,
    };
  }

  if (isLegacyV2TimetableAssetIndex(storedIndex)) {
    return {
      index: {
        schemaVersion: 3,
        activeAssetId: storedIndex.activeAssetId,
        assets: storedIndex.assets.map(migrateV2Asset),
      },
      shouldPersist: true,
      shouldRemoveLegacyMeta: false,
    };
  }

  const legacyIndex = isLegacyTimetableAssetIndex(storedIndex)
    ? storedIndex
    : undefined;
  const legacyMeta =
    !legacyIndex && isLegacyTimetableAssetMeta(storedLegacyMeta)
      ? storedLegacyMeta
      : undefined;
  const legacyAssets = legacyIndex?.assets ?? (legacyMeta ? [legacyMeta] : []);

  if (legacyAssets.length === 0) {
    return {
      index: createEmptyTimetableAssetIndex(),
      shouldPersist: false,
      shouldRemoveLegacyMeta: false,
    };
  }

  return {
    index: {
      schemaVersion: 3,
      activeAssetId: legacyIndex?.activeAssetId ?? legacyMeta?.id ?? null,
      assets: legacyAssets.map(migrateLegacyAsset),
    },
    shouldPersist: true,
    shouldRemoveLegacyMeta: Boolean(legacyMeta),
  };
}
