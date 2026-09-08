const EVERYTIME_SUBJECT_COLORS = [
  "color1",
  "color2",
  "color3",
  "color4",
  "color5",
  "color6",
  "color7",
  "color8",
  "color9",
  "color10",
  "color11",
  "color12",
  "color13",
  "color14",
  "color15",
  "color16",
] as const;

// Original light pastel tones with a neutral gray instead of a similar pink.
const CURATED_PASTEL_COLORS = [
  "#fee5e5", // red
  "#ffefd9", // orange
  "#fefac9", // yellow
  "#eefcd0", // lime
  "#d6fae8", // emerald
  "#d4fafe", // cyan
  "#dfecfe", // blue
  "#efebfe", // violet
  "#faeaff", // fuchsia
  "#e8e8e8", // neutral gray
] as const;

export type EverytimeSubjectColor = (typeof EVERYTIME_SUBJECT_COLORS)[number];

export const DEFAULT_EVERYTIME_SUBJECT_COLOR: EverytimeSubjectColor = "color1";

export function isEverytimeSubjectColor(
  value: string,
): value is EverytimeSubjectColor {
  return (EVERYTIME_SUBJECT_COLORS as readonly string[]).includes(value);
}

export function createEverytimeSubjectColorMap(
  courseKeys: readonly string[],
): Map<string, string> {
  const colorsByKey = new Map<string, string>();

  courseKeys.forEach((key) => {
    if (colorsByKey.has(key)) {
      return;
    }

    const color =
      CURATED_PASTEL_COLORS[colorsByKey.size % CURATED_PASTEL_COLORS.length];

    colorsByKey.set(key, color);
  });

  return colorsByKey;
}
