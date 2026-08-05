import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { EverytimeSubjectTooltip } from "@/components/Tabs/TimeTable/EverytimeSubjectTooltip";
import { cn } from "@/lib/utils";
import type { EverytimeSubject } from "@/types/timetable";
import type { EverytimeSubjectColor } from "@/utils/everytimeTimetableColor";

const SUBJECT_COLOR_CLASS_NAMES: Record<string, string> = {
  color1: "bg-red-100 text-red-950",
  color2: "bg-rose-100 text-rose-950",
  color3: "bg-lime-100 text-lime-950",
  color4: "bg-emerald-100 text-emerald-950",
  color5: "bg-sky-100 text-sky-950",
  color6: "bg-violet-100 text-violet-950",
  color7: "bg-orange-100 text-orange-950",
  color8: "bg-amber-100 text-amber-950",
  color9: "bg-cyan-100 text-cyan-950",
  color10: "bg-blue-100 text-blue-950",
  color11: "bg-fuchsia-100 text-fuchsia-950",
  color12: "bg-teal-100 text-teal-950",
  color13: "bg-yellow-100 text-yellow-950",
  color14: "bg-green-100 text-green-950",
  color15: "bg-indigo-100 text-indigo-950",
  color16: "bg-pink-100 text-pink-950",
} satisfies Record<EverytimeSubjectColor, string>;

const FALLBACK_SUBJECT_COLOR_CLASS_NAME = "bg-neutral-200 text-neutral-900";
const SUBJECT_TITLE_MAX_HEIGHT_EM = 2.4;
const OVERFLOW_TOLERANCE_PX = 1;
const TOOLTIP_HOVER_DELAY_MS = 300;

function useSubjectContentOverflow(
  title: string,
  subjectHeight: number,
  detailLineCount: number,
) {
  const contentRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLParagraphElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);

  useLayoutEffect(() => {
    const content = contentRef.current;
    const viewport = viewportRef.current;
    const titleElement = titleRef.current;

    if (!content || !viewport || !titleElement) {
      return;
    }

    const updateOverflow = () => {
      const titleOverflows =
        titleElement.scrollHeight - viewport.clientHeight >
        OVERFLOW_TOLERANCE_PX;
      const contentOverflows =
        content.scrollHeight - content.clientHeight > OVERFLOW_TOLERANCE_PX;

      setHasOverflow(titleOverflows || contentOverflows);
    };

    updateOverflow();

    const resizeObserver = new ResizeObserver(updateOverflow);
    resizeObserver.observe(content);
    resizeObserver.observe(viewport);
    resizeObserver.observe(titleElement);

    return () => resizeObserver.disconnect();
  }, [detailLineCount, subjectHeight, title]);

  return { contentRef, hasOverflow, titleRef, viewportRef };
}

function formatEverytimeTime(time: number): string {
  const minutes = time * 5;
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function getSubjectDescription(
  subject: EverytimeSubject,
  weekday: string,
): string {
  const fallbackDetail =
    !subject.professor && !subject.place ? subject.detail : undefined;
  const meetingTime =
    subject.startTime !== undefined && subject.endTime !== undefined
      ? `${weekday}요일 ${formatEverytimeTime(subject.startTime)}–${formatEverytimeTime(subject.endTime)}`
      : weekday
        ? `${weekday}요일`
        : undefined;

  return [
    subject.title,
    subject.professor ? `담당 ${subject.professor}` : undefined,
    subject.place ? `강의실 ${subject.place}` : undefined,
    fallbackDetail,
    meetingTime,
    subject.timeText,
    subject.credit !== undefined ? `${subject.credit}학점` : undefined,
    subject.isClosed ? "폐강" : undefined,
  ]
    .filter(Boolean)
    .join(" · ");
}

function getSubjectDetailLines(subject: EverytimeSubject): string[] {
  const structuredDetails = [subject.professor, subject.place].filter(
    (detail): detail is string => Boolean(detail),
  );

  if (structuredDetails.length > 0) {
    return structuredDetails;
  }

  return subject.detail ? [subject.detail] : [];
}

interface EverytimeSubjectCardProps {
  subject: EverytimeSubject;
  weekday: string;
  viewportStart: number;
}

export function EverytimeSubjectCard({
  subject,
  weekday,
  viewportStart,
}: EverytimeSubjectCardProps) {
  const description = getSubjectDescription(subject, weekday);
  const detailLines = getSubjectDetailLines(subject);
  const articleRef = useRef<HTMLElement>(null);
  const tooltipTimerRef = useRef<number | null>(null);
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const { contentRef, hasOverflow, titleRef, viewportRef } =
    useSubjectContentOverflow(
      subject.title,
      subject.height,
      detailLines.length,
    );

  const clearTooltipTimer = () => {
    if (tooltipTimerRef.current !== null) {
      window.clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = null;
    }
  };

  const openTooltipAfterDelay = () => {
    if (!hasOverflow) {
      return;
    }

    clearTooltipTimer();
    tooltipTimerRef.current = window.setTimeout(() => {
      setIsTooltipOpen(true);
      tooltipTimerRef.current = null;
    }, TOOLTIP_HOVER_DELAY_MS);
  };

  const closeTooltip = () => {
    clearTooltipTimer();
    setIsTooltipOpen(false);
  };

  useEffect(
    () => () => {
      if (tooltipTimerRef.current !== null) {
        window.clearTimeout(tooltipTimerRef.current);
      }
    },
    [],
  );

  return (
    <>
      <article
        ref={articleRef}
        className={cn(
          "absolute inset-x-0 overflow-hidden border-y border-white/70 px-1 py-px text-sm font-medium leading-[1.2] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-main/60",
          SUBJECT_COLOR_CLASS_NAMES[subject.color] ??
            FALLBACK_SUBJECT_COLOR_CLASS_NAME,
        )}
        style={{
          top: `${subject.top - viewportStart}px`,
          height: `${subject.height}px`,
        }}
        tabIndex={hasOverflow ? 0 : undefined}
        aria-label={description}
        onMouseEnter={openTooltipAfterDelay}
        onMouseLeave={closeTooltip}
        onFocus={() => hasOverflow && setIsTooltipOpen(true)}
        onBlur={closeTooltip}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            closeTooltip();
          }
        }}
      >
        <div
          ref={contentRef}
          className="flex h-full min-h-0 flex-col overflow-hidden"
        >
          <div
            ref={viewportRef}
            className="min-h-0 shrink overflow-hidden"
            style={{ maxHeight: `${SUBJECT_TITLE_MAX_HEIGHT_EM}em` }}
          >
            <p ref={titleRef} className="break-words">
              {subject.title}
            </p>
          </div>
          {detailLines.map((detail, index) => (
            <p
              key={`${subject.id}:detail:${index}`}
              className="shrink-0 truncate font-normal text-xs leading-[1.2]"
            >
              {detail}
            </p>
          ))}
        </div>
      </article>

      <EverytimeSubjectTooltip
        anchorRef={articleRef}
        detailLines={detailLines}
        open={hasOverflow && isTooltipOpen}
        subject={subject}
      />
    </>
  );
}
