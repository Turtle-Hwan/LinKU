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

// Contrast with #171717 and pairwise OKLab distances are guarded by tests.
// The first ten colors prioritize separation for typical course loads.
const CURATED_PASTEL_COLORS = [
  "#f7a1a1",
  "#a1f7a1",
  "#a1a1f7",
  "#f7d0a1",
  "#f3a1f7",
  "#a1f3f7",
  "#fcd9fc",
  "#bac3de",
  "#fafabd",
  "#fabdde",
  "#c9aff8",
  "#e3beb5",
  "#dbf8fa",
  "#b5e3c7",
  "#fbe5cb",
  "#f7a1cc",
  "#d8cef8",
  "#d9edab",
  "#a1ddf7",
  "#a1bbf7",
  "#deb5e3",
  "#c4dee3",
  "#fce9f2",
  "#fbfbea",
  "#e8b0c1",
  "#f7e2a1",
  "#a1ccf7",
  "#e8dacf",
  "#e3c4d5",
  "#cbebdb",
  "#c9c1f6",
  "#e4d9ed",
  "#f7b2a1",
  "#cbfbe3",
  "#faccbd",
  "#d9e9fc",
  "#c0fabd",
  "#f8afe6",
  "#a6f2cc",
  "#bcb5e3",
  "#e3efc8",
  "#bfa1f7",
  "#d9a1f7",
  "#deceba",
  "#eaf7a1",
  "#fabdc0",
  "#eabdfa",
  "#e3deb5",
  "#b5edab",
  "#aeabed",
] as const;

export type EverytimeSubjectColor = (typeof EVERYTIME_SUBJECT_COLORS)[number];

export const DEFAULT_EVERYTIME_SUBJECT_COLOR: EverytimeSubjectColor = "color1";

export interface EverytimeSubjectColorCandidate {
  key: string;
}

export function isEverytimeSubjectColor(
  value: string,
): value is EverytimeSubjectColor {
  return (EVERYTIME_SUBJECT_COLORS as readonly string[]).includes(value);
}

export function createEverytimeSubjectColorMap(
  candidates: readonly EverytimeSubjectColorCandidate[],
): Map<string, string> {
  const colorsByKey = new Map<string, string>();

  candidates.forEach(({ key }) => {
    if (colorsByKey.has(key)) {
      return;
    }

    const color = CURATED_PASTEL_COLORS[colorsByKey.size];
    if (!color) {
      throw new RangeError("시간표는 최대 50개의 고유 과목 색상을 지원합니다.");
    }

    colorsByKey.set(key, color);
  });

  return colorsByKey;
}
