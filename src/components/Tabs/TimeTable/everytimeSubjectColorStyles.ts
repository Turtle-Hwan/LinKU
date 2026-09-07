import type { CSSProperties } from "react";
import type { EverytimeSubjectColor } from "@/utils/everytimeTimetableColor";

const SUBJECT_COLOR_CLASS_NAMES: Record<EverytimeSubjectColor, string> = {
  color1: "bg-red-50 text-red-950",
  color2: "bg-rose-50 text-rose-950",
  color3: "bg-lime-50 text-lime-950",
  color4: "bg-emerald-50 text-emerald-950",
  color5: "bg-sky-50 text-sky-950",
  color6: "bg-violet-50 text-violet-950",
  color7: "bg-orange-50 text-orange-950",
  color8: "bg-amber-50 text-amber-950",
  color9: "bg-cyan-50 text-cyan-950",
  color10: "bg-blue-50 text-blue-950",
  color11: "bg-fuchsia-50 text-fuchsia-950",
  color12: "bg-teal-50 text-teal-950",
  color13: "bg-yellow-50 text-yellow-950",
  color14: "bg-green-50 text-green-950",
  color15: "bg-indigo-50 text-indigo-950",
  color16: "bg-pink-50 text-pink-950",
};

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
    className:
      SUBJECT_COLOR_CLASS_NAMES[color as EverytimeSubjectColor] ??
      FALLBACK_SUBJECT_COLOR_CLASS_NAME,
  };
}
