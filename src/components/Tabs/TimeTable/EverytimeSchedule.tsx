import React, { useMemo } from "react";
import { EverytimeSubjectCard } from "@/components/Tabs/TimeTable/EverytimeSubjectCard";
import type {
  EverytimeSubject,
  EverytimeTimetable,
} from "@/types/timetable";

const GRID_INTERVAL_HEIGHT_PX = 25;
const HOUR_HEIGHT_PX = GRID_INTERVAL_HEIGHT_PX * 2;
const VIEWPORT_PADDING_PX = GRID_INTERVAL_HEIGHT_PX;
const MIN_TIMETABLE_HEIGHT_PX = GRID_INTERVAL_HEIGHT_PX * 6;
const DEFAULT_VISIBLE_WEEKDAY_COUNT = 5;
const TIME_AXIS_WIDTH_PX = 38;
const GRID_LINE_HEIGHT_PX = 1;
const GRID_LINE_START_PX = GRID_INTERVAL_HEIGHT_PX - GRID_LINE_HEIGHT_PX;
const GRID_LINE_COLOR = "rgb(244 244 245)";
const GRID_BACKGROUND_IMAGE = `repeating-linear-gradient(
  to bottom,
  transparent 0,
  transparent ${GRID_LINE_START_PX}px,
  ${GRID_LINE_COLOR} ${GRID_LINE_START_PX}px,
  ${GRID_LINE_COLOR} ${GRID_INTERVAL_HEIGHT_PX}px
)`;

interface TimetableViewport {
  height: number;
  start: number;
}

interface TimeLabel {
  hour: number;
  label: string;
}

function getTimetableViewport(timetable: EverytimeTimetable): TimetableViewport {
  if (timetable.subjects.length === 0) {
    return {
      start: 0,
      height: Math.max(
        MIN_TIMETABLE_HEIGHT_PX,
        timetable.slotCount * GRID_INTERVAL_HEIGHT_PX,
      ),
    };
  }

  const firstSubjectTop = Math.min(
    ...timetable.subjects.map((subject) => subject.top),
  );
  const lastSubjectBottom = Math.max(
    ...timetable.subjects.map((subject) => subject.top + subject.height),
  );
  const start = Math.max(
    0,
    Math.floor((firstSubjectTop - VIEWPORT_PADDING_PX) / HOUR_HEIGHT_PX) *
      HOUR_HEIGHT_PX,
  );
  const end =
    Math.ceil((lastSubjectBottom + VIEWPORT_PADDING_PX) / HOUR_HEIGHT_PX) *
    HOUR_HEIGHT_PX;

  return {
    start,
    height: Math.max(MIN_TIMETABLE_HEIGHT_PX, end - start),
  };
}

function groupSubjectsByDay(
  subjects: EverytimeSubject[],
  weekdayCount: number,
): EverytimeSubject[][] {
  const groupedSubjects = Array.from(
    { length: weekdayCount },
    (): EverytimeSubject[] => [],
  );

  subjects.forEach((subject) => {
    groupedSubjects[subject.dayIndex]?.push(subject);
  });

  return groupedSubjects;
}

function getVisibleWeekdays(timetable: EverytimeTimetable): string[] {
  const lastScheduledDayIndex = Math.max(
    -1,
    ...timetable.subjects.map((subject) => subject.dayIndex),
  );
  const visibleWeekdayCount = Math.min(
    timetable.weekdays.length,
    Math.max(DEFAULT_VISIBLE_WEEKDAY_COUNT, lastScheduledDayIndex + 1),
  );

  return timetable.weekdays.slice(0, visibleWeekdayCount);
}

function getTimeLabels(viewport: TimetableViewport): TimeLabel[] {
  const startHour = viewport.start / HOUR_HEIGHT_PX;
  const hourCount = Math.ceil(viewport.height / HOUR_HEIGHT_PX);

  return Array.from({ length: hourCount }, (_, index) => {
    const hour = startHour + index;
    return {
      hour,
      label: `${String(hour).padStart(2, "0")}:00`,
    };
  });
}

interface EverytimeScheduleProps {
  timetable: EverytimeTimetable;
}

function EverytimeScheduleComponent({ timetable }: EverytimeScheduleProps) {
  const viewport = useMemo(
    () => getTimetableViewport(timetable),
    [timetable],
  );
  const visibleWeekdays = useMemo(
    () => getVisibleWeekdays(timetable),
    [timetable],
  );
  const subjectsByDay = useMemo(
    () => groupSubjectsByDay(timetable.subjects, visibleWeekdays.length),
    [timetable.subjects, visibleWeekdays.length],
  );
  const timeLabels = useMemo(() => getTimeLabels(viewport), [viewport]);
  const scheduleGridStyle = useMemo(
    () => ({
      gridTemplateColumns: `${TIME_AXIS_WIDTH_PX}px repeat(${visibleWeekdays.length}, minmax(0, 1fr))`,
    }),
    [visibleWeekdays.length],
  );

  if (timetable.subjects.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border bg-neutral-50 px-6 text-center text-sm leading-[1.5] text-muted-foreground">
        이 학기에는 표시할 수업이 없습니다.
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-neutral-200/70 bg-white">
      <div className="flex min-h-full w-full flex-col bg-white">
        <div
          className="sticky top-0 z-10 grid shrink-0 border-b border-neutral-200/70 bg-white text-sm font-medium leading-[1.5] text-neutral-700"
          style={scheduleGridStyle}
        >
          <div
            className="border-r border-neutral-200/70 px-0.5 py-1.5 text-center text-[10px] font-normal text-neutral-500"
            aria-hidden="true"
          >
            시간
          </div>
          {visibleWeekdays.map((weekday) => (
            <div
              key={weekday}
              className="border-r border-neutral-200/70 px-1 py-1.5 text-center last:border-r-0"
            >
              {weekday}
            </div>
          ))}
        </div>
        <div
          className="grid flex-1"
          style={{
            ...scheduleGridStyle,
            minHeight: `${viewport.height}px`,
          }}
        >
          <div
            className="h-full border-r border-neutral-200/70 bg-neutral-50/50"
            aria-hidden="true"
          >
            {timeLabels.map((time) => (
              <div
                key={time.hour}
                className="border-b border-neutral-100 px-0.5 pt-1 text-center text-[10px] font-normal leading-none text-neutral-500 last:border-b-0"
                style={{ height: `${HOUR_HEIGHT_PX}px` }}
              >
                {time.label}
              </div>
            ))}
          </div>
          {visibleWeekdays.map((weekday, dayIndex) => (
            <div
              key={weekday}
              className="relative h-full border-r border-neutral-200/70 last:border-r-0"
              style={{ backgroundImage: GRID_BACKGROUND_IMAGE }}
            >
              {subjectsByDay[dayIndex]?.map((subject) => (
                <EverytimeSubjectCard
                  key={subject.id}
                  subject={subject}
                  viewportStart={viewport.start}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const EverytimeSchedule = React.memo(EverytimeScheduleComponent);
