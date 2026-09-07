import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { EverytimeSubjectTooltip } from "@/components/Tabs/TimeTable/EverytimeSubjectTooltip";
import { getEverytimeSubjectColorPresentation } from "@/components/Tabs/TimeTable/everytimeSubjectColorStyles";
import { cn } from "@/lib/utils";
import type { EverytimeSubject } from "@/types/timetable";
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
  color?: string;
  subject: EverytimeSubject;
  weekday: string;
  viewportStart: number;
}

export function EverytimeSubjectCard({
  color,
  subject,
  weekday,
  viewportStart,
}: EverytimeSubjectCardProps) {
  const description = getSubjectDescription(subject, weekday);
  const detailLines = getSubjectDetailLines(subject);
  const colorPresentation = getEverytimeSubjectColorPresentation(
    color ?? subject.color,
  );
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
          colorPresentation.className,
        )}
        style={{
          top: `${subject.top - viewportStart}px`,
          height: `${subject.height}px`,
          ...colorPresentation.style,
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
