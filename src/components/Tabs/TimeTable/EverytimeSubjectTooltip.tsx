import { useLayoutEffect, useRef, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { EverytimeSubject } from "@/types/timetable";

const TOOLTIP_GAP_PX = 8;
const VIEWPORT_PADDING_PX = 8;

interface EverytimeSubjectTooltipProps {
  anchorRef: RefObject<HTMLElement | null>;
  detailLines: string[];
  open: boolean;
  subject: EverytimeSubject;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function EverytimeSubjectTooltip({
  anchorRef,
  detailLines,
  open,
  subject,
}: EverytimeSubjectTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const detailText = detailLines.join("\n");

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const tooltip = tooltipRef.current;
    if (!open || !anchor || !tooltip) {
      return;
    }

    const updatePosition = () => {
      const anchorRect = anchor.getBoundingClientRect();
      const tooltipWidth = tooltip.offsetWidth;
      const tooltipHeight = tooltip.offsetHeight;
      const maxLeft = Math.max(
        VIEWPORT_PADDING_PX,
        window.innerWidth - tooltipWidth - VIEWPORT_PADDING_PX,
      );
      const left = clamp(
        anchorRect.left + anchorRect.width / 2 - tooltipWidth / 2,
        VIEWPORT_PADDING_PX,
        maxLeft,
      );
      const spaceBelow = window.innerHeight - anchorRect.bottom;
      const top =
        spaceBelow >= tooltipHeight + TOOLTIP_GAP_PX + VIEWPORT_PADDING_PX
          ? anchorRect.bottom + TOOLTIP_GAP_PX
          : Math.max(
              VIEWPORT_PADDING_PX,
              anchorRect.top - tooltipHeight - TOOLTIP_GAP_PX,
            );

      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
      tooltip.style.visibility = "visible";
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorRef, detailText, open, subject.title]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div
      ref={tooltipRef}
      aria-hidden="true"
      data-everytime-subject-tooltip=""
      className="pointer-events-none fixed z-[100] w-60 max-w-[calc(100vw-1rem)] rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-left text-neutral-950 shadow-xl"
      style={{ visibility: "hidden" }}
    >
      <p className="break-words text-[15px] font-semibold leading-[1.5]">
        {subject.title}
      </p>
      {detailLines.map((detail, index) => (
        <p
          key={`${subject.id}:tooltip-detail:${index}`}
          className={
            index === 0
              ? "mt-1.5 text-sm leading-[1.5] text-neutral-700"
              : "text-sm leading-[1.5] text-neutral-700"
          }
        >
          {detail}
        </p>
      ))}
    </div>,
    document.body,
  );
}
