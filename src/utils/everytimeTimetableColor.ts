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

export type EverytimeSubjectColor = (typeof EVERYTIME_SUBJECT_COLORS)[number];

export const DEFAULT_EVERYTIME_SUBJECT_COLOR: EverytimeSubjectColor = "color1";

export function isEverytimeSubjectColor(
  value: string,
): value is EverytimeSubjectColor {
  return (EVERYTIME_SUBJECT_COLORS as readonly string[]).includes(value);
}

export function getStableEverytimeSubjectColor(
  courseId: string,
): EverytimeSubjectColor {
  const hash = Array.from(courseId).reduce(
    (value, character, index) =>
      value + (character.codePointAt(0) ?? 0) * (index + 1),
    0,
  );

  return (
    EVERYTIME_SUBJECT_COLORS[hash % EVERYTIME_SUBJECT_COLORS.length] ??
    DEFAULT_EVERYTIME_SUBJECT_COLOR
  );
}
