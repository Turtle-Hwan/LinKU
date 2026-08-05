import type {
  EverytimeCourse,
  EverytimeCourseOverride,
  EverytimeSubject,
  EverytimeSubjectOverride,
  EverytimeTimetable,
  EverytimeTimetableOverride,
  EverytimeTimetableOverrideInput,
} from "@/types/timetable";

const DETAIL_FIELDS = ["professor", "place"] as const;

function hasOwnProperty<T extends object>(object: T, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function mergeCourse(
  course: EverytimeCourse,
  override?: EverytimeCourseOverride,
): EverytimeCourse {
  if (!override) {
    return course;
  }

  return {
    ...course,
    ...override,
    id: course.id,
    internalId: course.internalId,
    meetings: course.meetings,
  };
}

function getCourseFieldsForSubject(
  override?: EverytimeCourseOverride,
): EverytimeSubjectOverride | undefined {
  return override;
}

function mergeSubject(
  subject: EverytimeSubject,
  courseOverride?: EverytimeCourseOverride,
  subjectOverride?: EverytimeSubjectOverride,
): EverytimeSubject {
  if (!courseOverride && !subjectOverride) {
    return subject;
  }

  const courseFields = getCourseFieldsForSubject(courseOverride);
  const mergedSubject: EverytimeSubject = {
    ...subject,
    ...courseFields,
    ...subjectOverride,
    id: subject.id,
    subjectId: subject.subjectId,
    internalId: subject.internalId,
  };
  const detailFieldsChanged = DETAIL_FIELDS.some(
    (field) =>
      (courseFields && hasOwnProperty(courseFields, field)) ||
      (subjectOverride && hasOwnProperty(subjectOverride, field)),
  );
  const detailWasOverridden =
    subjectOverride && hasOwnProperty(subjectOverride, "detail");

  if (detailFieldsChanged && !detailWasOverridden) {
    mergedSubject.detail =
      [mergedSubject.professor, mergedSubject.place]
        .filter(Boolean)
        .join(" · ") || undefined;
  }

  return mergedSubject;
}

function appendUniqueById<T extends { id: string }>(
  source: T[],
  additions: T[],
): T[] {
  const sourceIds = new Set(source.map((item) => item.id));
  return [
    ...source,
    ...additions.filter((item) => !sourceIds.has(item.id)),
  ];
}

export function createEverytimeTimetableOverride(
  assetId: string,
  input: EverytimeTimetableOverrideInput,
  updatedAt = new Date().toISOString(),
): EverytimeTimetableOverride {
  return {
    schemaVersion: 1,
    assetId,
    courseOverrides: input.courseOverrides ?? {},
    subjectOverrides: input.subjectOverrides ?? {},
    hiddenCourseIds: [...new Set(input.hiddenCourseIds ?? [])],
    hiddenSubjectIds: [...new Set(input.hiddenSubjectIds ?? [])],
    addedCourses: input.addedCourses ?? [],
    addedSubjects: input.addedSubjects ?? [],
    updatedAt,
  };
}

export function isEverytimeTimetableOverrideEmpty(
  override: EverytimeTimetableOverride,
): boolean {
  return (
    Object.keys(override.courseOverrides).length === 0 &&
    Object.keys(override.subjectOverrides).length === 0 &&
    override.hiddenCourseIds.length === 0 &&
    override.hiddenSubjectIds.length === 0 &&
    override.addedCourses.length === 0 &&
    override.addedSubjects.length === 0
  );
}

export function mergeEverytimeTimetable(
  snapshot: EverytimeTimetable,
  override?: EverytimeTimetableOverride,
): EverytimeTimetable {
  if (!override || isEverytimeTimetableOverrideEmpty(override)) {
    return snapshot;
  }

  const hiddenCourseIds = new Set(override.hiddenCourseIds);
  const hiddenSubjectIds = new Set(override.hiddenSubjectIds);
  const snapshotCourses = (snapshot.courses ?? [])
    .filter((course) => !hiddenCourseIds.has(course.id))
    .map((course) => mergeCourse(course, override.courseOverrides[course.id]));
  const addedCourses = override.addedCourses
    .filter((course) => !hiddenCourseIds.has(course.id))
    .map((course) => mergeCourse(course, override.courseOverrides[course.id]));
  const courses = appendUniqueById(snapshotCourses, addedCourses);
  const snapshotSubjects = snapshot.subjects
    .filter(
      (subject) =>
        !hiddenSubjectIds.has(subject.id) &&
        (!subject.subjectId || !hiddenCourseIds.has(subject.subjectId)),
    )
    .map((subject) =>
      mergeSubject(
        subject,
        subject.subjectId
          ? override.courseOverrides[subject.subjectId]
          : undefined,
        override.subjectOverrides[subject.id],
      ),
    );
  const addedSubjects = override.addedSubjects
    .filter(
      (subject) =>
        !hiddenSubjectIds.has(subject.id) &&
        (!subject.subjectId || !hiddenCourseIds.has(subject.subjectId)),
    )
    .map((subject) =>
      mergeSubject(
        subject,
        subject.subjectId
          ? override.courseOverrides[subject.subjectId]
          : undefined,
        override.subjectOverrides[subject.id],
      ),
    );

  return {
    ...snapshot,
    courses:
      snapshot.courses !== undefined || courses.length > 0 ? courses : undefined,
    subjects: appendUniqueById(snapshotSubjects, addedSubjects),
  };
}
