import {
  BackgroundMessageType,
  type TimetableImportResponse,
} from "@/background/types";
import type { TimetableImportMode } from "@/types/timetable";

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

  return chrome.runtime.sendMessage({
    type: BackgroundMessageType.TIMETABLE_IMPORT,
    data: { mode },
  });
}
