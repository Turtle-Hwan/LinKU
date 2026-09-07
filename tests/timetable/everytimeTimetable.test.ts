import assert from "node:assert/strict";
import test from "node:test";
import {
  createEverytimeTimetableOverride,
  getEverytimeSubjectCourseKey,
  getUnscheduledEverytimeCourses,
  mergeEverytimeTimetable,
} from "../../src/utils/everytimeTimetable.ts";

const snapshot = {
  semester: "2025년 2학기",
  weekdays: ["월", "화", "수", "목", "금"],
  slotCount: 48,
  courses: [
    {
      id: "course-1",
      title: "원본 과목",
      professor: "원본 교수",
      meetings: [{ dayIndex: 0, startTime: 108, endTime: 126 }],
    },
  ],
  subjects: [
    {
      id: "subject-1",
      subjectId: "course-1",
      dayIndex: 0,
      title: "원본 과목",
      professor: "원본 교수",
      detail: "원본 교수 · 공학관",
      place: "공학관",
      color: "color1",
      top: 450,
      height: 75,
    },
  ],
};

test("새 snapshot에 사용자 override를 병합하고 원본은 변경하지 않는다", () => {
  const override = createEverytimeTimetableOverride(
    "everytime:2025년 2학기",
    {
      courseOverrides: {
        "course-1": { title: "사용자 과목명", professor: "사용자 교수명" },
      },
      subjectOverrides: {
        "subject-1": { place: "사용자 강의실", color: "color8" },
      },
    },
    "2026-08-05T00:00:00.000Z",
  );

  const nextSnapshot = {
    ...snapshot,
    subjects: snapshot.subjects.map((subject) => ({
      ...subject,
      timeText: "월 09:00-10:30",
    })),
  };
  const merged = mergeEverytimeTimetable(nextSnapshot, override);

  assert.deepEqual(merged.subjects[0], {
    ...nextSnapshot.subjects[0],
    internalId: undefined,
    title: "사용자 과목명",
    professor: "사용자 교수명",
    place: "사용자 강의실",
    detail: "사용자 교수명 · 사용자 강의실",
    color: "color8",
  });
  assert.equal(snapshot.subjects[0].title, "원본 과목");
  assert.equal(merged.subjects[0].timeText, "월 09:00-10:30");
});

test("시간 좌표가 없는 이러닝 과목을 별도로 찾는다", () => {
  const onlineCourse = {
    id: "course-online",
    title: "컴퓨팅적사고",
    professor: "온라인교수",
    timeText: "이러닝",
    meetings: [],
  };
  const timetable = {
    ...snapshot,
    courses: [...snapshot.courses, onlineCourse],
  };

  assert.deepEqual(getUnscheduledEverytimeCourses(timetable), [onlineCourse]);
});

test("DOM fallback의 같은 과목 블록은 제목과 교수로 묶는다", () => {
  assert.equal(
    getEverytimeSubjectCourseKey({
      title: "자료구조",
      professor: "김교수",
    }),
    getEverytimeSubjectCourseKey({
      title: "자료구조",
      professor: "김교수",
    }),
  );
  assert.notEqual(
    getEverytimeSubjectCourseKey({
      title: "자료구조",
      professor: "김교수",
    }),
    getEverytimeSubjectCourseKey({
      title: "자료구조",
      professor: "이교수",
    }),
  );
});
