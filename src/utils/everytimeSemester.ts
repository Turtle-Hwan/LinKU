import type { EverytimeSemesterTerm } from "@/types/timetable";

export const EVERYTIME_SEMESTER_PATTERN =
  /^(20\d{2})년\s*(1|2|여름|겨울)학기$/;

const EVERYTIME_SEMESTER_TERM_ORDER: Record<EverytimeSemesterTerm, number> = {
  "1": 0,
  여름: 1,
  "2": 2,
  겨울: 3,
};

const EVERYTIME_SEMESTER_TERM_COUNT = Object.keys(
  EVERYTIME_SEMESTER_TERM_ORDER,
).length;

export interface EverytimeSemesterPeriod {
  label: string;
  year: number;
  term: EverytimeSemesterTerm;
  sortKey: number;
}

export function isEverytimeSemesterTerm(
  value?: string,
): value is EverytimeSemesterTerm {
  return (
    value !== undefined &&
    Object.prototype.hasOwnProperty.call(EVERYTIME_SEMESTER_TERM_ORDER, value)
  );
}

export function getEverytimeSemesterSortKey(
  year: number,
  term: EverytimeSemesterTerm,
): number {
  return (
    year * EVERYTIME_SEMESTER_TERM_COUNT +
    EVERYTIME_SEMESTER_TERM_ORDER[term]
  );
}

export function formatEverytimeSemester(
  year: number,
  term: EverytimeSemesterTerm,
): string {
  return `${year}년 ${term}학기`;
}

export function getLatestEverytimeSemesterAnchor(
  now: Date,
): Pick<EverytimeSemesterPeriod, "year" | "term" | "sortKey"> {
  const month = now.getMonth();
  const isWinterBreak = month === 11;
  const year = isWinterBreak ? now.getFullYear() + 1 : now.getFullYear();
  const term = month < 5 || isWinterBreak ? "1" : "2";

  return {
    year,
    term,
    // 1~5월에는 해당 연도 1학기, 6~11월에는 다음 정규학기인 2학기를
    // 기준으로 삼는다. 12월 겨울방학에는 다음 연도 1학기를 기준으로 삼아
    // 현재 겨울학기도 최근 학기 후보에 포함한다.
    sortKey: getEverytimeSemesterSortKey(year, term),
  };
}

export function parseEverytimeSemester(
  semester: string,
): EverytimeSemesterPeriod | null {
  const match = semester.match(EVERYTIME_SEMESTER_PATTERN);
  if (!match) {
    return null;
  }

  const year = Number.parseInt(match[1], 10);
  const term = match[2];
  if (!isEverytimeSemesterTerm(term)) {
    return null;
  }

  return {
    label: semester,
    year,
    term,
    sortKey: getEverytimeSemesterSortKey(year, term),
  };
}
