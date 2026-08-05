export const TIMETABLE_STORAGE_KEYS = {
  assetIndex: "timetableAssetIndex",
  legacyMeta: "timetableAssetMeta",
  everytimeImportedSemesters: "timetableEverytimeImportedSemesters",
  everytimeOverrides: "timetableEverytimeOverrides",
  pendingImport: "timetablePendingEverytimeImport",
} as const;

export type TimetableSource = "upload" | "everytime";
export type TimetableSyncStatus = "local" | "pending" | "synced" | "error";

export type EverytimeSemesterTerm = "1" | "여름" | "2" | "겨울";

export interface EverytimeSemesterMetadata {
  year: number;
  term: EverytimeSemesterTerm;
  startDate?: string;
  endDate?: string;
  isFormal?: boolean;
  isSupported?: boolean;
  hasSyllabus?: boolean;
  hasSubjectDatabase?: boolean;
  subjectDatabaseUpdatedAt?: string;
}

export interface EverytimeTableMetadata {
  id?: string;
  name?: string;
  year?: number;
  term?: EverytimeSemesterTerm;
  isDeleted?: boolean;
  isPrivate?: boolean;
  isPrimary?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface EverytimeCourseMeeting {
  dayIndex: number;
  startTime: number;
  endTime: number;
  place?: string;
}

export interface EverytimeCourse {
  id: string;
  internalId?: string;
  title: string;
  professor?: string;
  timeText?: string;
  defaultPlace?: string;
  credit?: number;
  isClosed?: boolean;
  meetings: EverytimeCourseMeeting[];
}

export interface EverytimeSubject {
  id: string;
  subjectId?: string;
  internalId?: string;
  dayIndex: number;
  title: string;
  professor?: string;
  place?: string;
  defaultPlace?: string;
  timeText?: string;
  credit?: number;
  isClosed?: boolean;
  startTime?: number;
  endTime?: number;
  detail?: string;
  color: string;
  top: number;
  height: number;
}

export interface EverytimeTimetable {
  semester: string;
  semesterMetadata?: EverytimeSemesterMetadata;
  tableMetadata?: EverytimeTableMetadata;
  courses?: EverytimeCourse[];
  weekdays: string[];
  slotCount: number;
  subjects: EverytimeSubject[];
}

export type EverytimeCourseOverride = Partial<
  Pick<
    EverytimeCourse,
    | "title"
    | "professor"
    | "timeText"
    | "defaultPlace"
    | "credit"
    | "isClosed"
  >
>;

export type EverytimeSubjectOverride = Partial<
  Pick<
    EverytimeSubject,
    | "dayIndex"
    | "title"
    | "professor"
    | "place"
    | "defaultPlace"
    | "timeText"
    | "credit"
    | "isClosed"
    | "startTime"
    | "endTime"
    | "detail"
    | "color"
    | "top"
    | "height"
  >
>;

export interface EverytimeTimetableOverrideInput {
  courseOverrides?: Record<string, EverytimeCourseOverride>;
  subjectOverrides?: Record<string, EverytimeSubjectOverride>;
  hiddenCourseIds?: string[];
  hiddenSubjectIds?: string[];
  addedCourses?: EverytimeCourse[];
  addedSubjects?: EverytimeSubject[];
}

export interface EverytimeTimetableOverride
  extends Required<EverytimeTimetableOverrideInput> {
  schemaVersion: 1;
  assetId: string;
  updatedAt: string;
}

export interface EverytimeTimetableOverrideIndex {
  schemaVersion: 1;
  overrides: Record<string, EverytimeTimetableOverride>;
}

interface TimetableMetaBase {
  schemaVersion: 3;
  id: string;
  source: TimetableSource;
  semester?: string;
  syncStatus: TimetableSyncStatus;
  createdAt: string;
  updatedAt: string;
}

export interface UploadedTimetableMeta extends TimetableMetaBase {
  source: "upload";
  mimeType: "image/png";
  width: number;
  height: number;
  byteSize: number;
  checksum: string;
}

export interface EverytimeTimetableMeta extends TimetableMetaBase {
  source: "everytime";
  snapshot: EverytimeTimetable;
  snapshotChecksum: string;
}

export type TimetableAssetMeta =
  | UploadedTimetableMeta
  | EverytimeTimetableMeta;

export type ResolvedTimetableAsset =
  | {
      kind: "upload";
      meta: UploadedTimetableMeta;
      blob: Blob;
    }
  | {
      kind: "everytime";
      meta: EverytimeTimetableMeta;
      override: EverytimeTimetableOverride | null;
      timetable: EverytimeTimetable;
    };

export interface SaveTimetableInput {
  id?: string;
  source: "upload";
  width: number;
  height: number;
}

export interface TimetableAssetIndex {
  schemaVersion: 3;
  activeAssetId: string | null;
  assets: TimetableAssetMeta[];
}

export interface PendingEverytimeImport {
  tabId: number;
  createdByLinku: boolean;
  requestedAt: string;
  mode: TimetableImportMode;
}

export type TimetableImportMode = "latest" | "previous";

export type TimetableImportErrorCode =
  | "LOGIN_REQUIRED"
  | "NO_PREVIOUS_SEMESTERS"
  | "TIMETABLE_NOT_FOUND"
  | "CAPTURE_FAILED"
  | "TAB_UNAVAILABLE"
  | "UNKNOWN";

export type TimetableImportResponse =
  | {
      success: true;
      activeAssetId: string | null;
      importedCount: number;
      updatedCount: number;
      skippedCount: number;
    }
  | {
      success: false;
      code: TimetableImportErrorCode;
      error: string;
      loginTabId?: number;
    };
