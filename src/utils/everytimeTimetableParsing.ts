import type { EverytimeCourse, EverytimeTimetable } from "@/types/timetable";

export function isPrimaryEverytimeTable(
  primary?: string | null,
  isPrimary?: string | null,
): boolean {
  return primary?.trim() === "1" || isPrimary?.trim() === "1";
}

export function createEverytimeNontimeCourses(
  semester: string,
  titles: readonly string[],
): EverytimeCourse[] {
  return titles.flatMap((rawTitle, sourceIndex) => {
    const title = rawTitle.trim();
    if (!title) {
      return [];
    }

    return [
      {
        id: `${semester}:nontime:${sourceIndex}`,
        title,
        meetings: [],
      },
    ];
  });
}

export function hasEverytimeTimetableData(
  timetable: EverytimeTimetable | null,
): timetable is EverytimeTimetable {
  return (
    timetable !== null &&
    (timetable.subjects.length > 0 || (timetable.courses?.length ?? 0) > 0)
  );
}
