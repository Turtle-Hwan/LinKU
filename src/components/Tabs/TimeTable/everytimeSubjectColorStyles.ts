import type { CSSProperties } from "react";

const FALLBACK_SUBJECT_COLOR_CLASS_NAME = "bg-neutral-100 text-neutral-900";
const GENERATED_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

export interface EverytimeSubjectColorPresentation {
  className: string;
  style?: CSSProperties;
}

export function getEverytimeSubjectColorPresentation(
  color?: string,
): EverytimeSubjectColorPresentation {
  if (color && GENERATED_COLOR_PATTERN.test(color)) {
    return {
      className: "text-neutral-950",
      style: {
        backgroundColor: color,
        color: "#171717",
      },
    };
  }

  return {
    className: FALLBACK_SUBJECT_COLOR_CLASS_NAME,
  };
}
