import type { TimetableAssetMeta } from "@/types/timetable";
import {
  getEverytimeSemesterSortKey,
  parseEverytimeSemester,
} from "@/utils/everytimeSemester";

function getAssetSemesterSortKey(asset: TimetableAssetMeta): number | null {
  if (asset.source === "everytime") {
    const semesterMetadata = asset.snapshot.semesterMetadata;
    if (semesterMetadata) {
      return getEverytimeSemesterSortKey(
        semesterMetadata.year,
        semesterMetadata.term,
      );
    }
  }

  return asset.semester
    ? (parseEverytimeSemester(asset.semester)?.sortKey ?? null)
    : null;
}

function compareTimetableAssetsBySemester(
  left: TimetableAssetMeta,
  right: TimetableAssetMeta,
): number {
  const leftSortKey = getAssetSemesterSortKey(left);
  const rightSortKey = getAssetSemesterSortKey(right);

  if (leftSortKey !== null && rightSortKey !== null) {
    return rightSortKey - leftSortKey;
  }
  if (leftSortKey !== null) {
    return -1;
  }
  if (rightSortKey !== null) {
    return 1;
  }

  return right.updatedAt.localeCompare(left.updatedAt);
}

export function sortTimetableAssetsBySemester(
  assets: readonly TimetableAssetMeta[],
): TimetableAssetMeta[] {
  return [...assets].sort(compareTimetableAssetsBySemester);
}
