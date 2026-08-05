import {
  BackgroundMessageType,
  type TimetableImportResponse,
} from "@/background/types";
import type { TimetableImportMode } from "@/types/timetable";

const TIMETABLE_IMPORT_ERROR_CODES = new Set([
  "LOGIN_REQUIRED",
  "NO_PREVIOUS_SEMESTERS",
  "TIMETABLE_NOT_FOUND",
  "CAPTURE_FAILED",
  "TAB_UNAVAILABLE",
  "UNKNOWN",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTimetableImportResponse(
  value: unknown,
): value is TimetableImportResponse {
  if (!isRecord(value) || typeof value.success !== "boolean") {
    return false;
  }

  if (!value.success) {
    return (
      typeof value.error === "string" &&
      typeof value.code === "string" &&
      TIMETABLE_IMPORT_ERROR_CODES.has(value.code)
    );
  }

  return (
    (typeof value.activeAssetId === "string" ||
      value.activeAssetId === null) &&
    typeof value.importedCount === "number" &&
    typeof value.updatedCount === "number" &&
    typeof value.skippedCount === "number"
  );
}

export async function importTimetableFromEverytime(
  mode: TimetableImportMode = "latest",
): Promise<TimetableImportResponse> {
  if (
    typeof chrome === "undefined" ||
    !chrome.runtime?.id ||
    !chrome.runtime.sendMessage
  ) {
    throw new Error(
      "에브리타임 연동은 빌드된 Chrome 확장 프로그램에서 확인할 수 있습니다.",
    );
  }

  const response: unknown = await chrome.runtime.sendMessage({
    type: BackgroundMessageType.TIMETABLE_IMPORT,
    data: { mode },
  });

  if (!isTimetableImportResponse(response)) {
    throw new Error(
      "확장 프로그램에서 응답을 받지 못했습니다. 확장 프로그램을 새로고침한 뒤 다시 시도해주세요.",
    );
  }

  return response;
}
