import type { EverytimeSemesterTerm } from "@/types/timetable";

const EVERYTIME_SEMESTER_PATTERN = /^(20\d{2})년\s*(1|2|여름|겨울)학기$/;

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

function isEverytimeSemesterTerm(
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
