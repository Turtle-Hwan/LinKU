import type { EverytimeCourse } from "@/types/timetable";

interface EverytimeUnscheduledCoursesProps {
  courses: EverytimeCourse[];
}

export function EverytimeUnscheduledCourses({
  courses,
}: EverytimeUnscheduledCoursesProps) {
  if (courses.length === 0) {
    return null;
  }

  return (
    <section
      className="shrink-0"
      aria-label="이러닝 및 시간 미정 수업"
    >
      <div className="mb-1.5 flex items-center justify-between gap-2 px-0.5 text-[11px] leading-[1.4] text-neutral-600">
        <h3 className="font-semibold text-neutral-800">
          이러닝 · 시간 미지정
        </h3>
        <span>{courses.length}과목</span>
      </div>
      <div className="overflow-hidden rounded-lg border border-neutral-200/80 bg-white">
        <table className="w-full table-fixed border-collapse text-left text-xs leading-[1.4]">
          <caption className="sr-only">
            요일과 시간이 지정되지 않은 이러닝 과목
          </caption>
          <tbody className="divide-y divide-neutral-200/80">
            {courses.map((course) => (
              <tr
                key={course.id}
                data-everytime-unscheduled-course=""
                className="border-t border-neutral-200/80 bg-neutral-50 text-neutral-900"
              >
                <th
                  scope="row"
                  className="truncate px-3 py-2 font-semibold"
                  title={course.title}
                >
                  {course.title}
                </th>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
