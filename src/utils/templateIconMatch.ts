import type { Icon } from "@/types/api";

export interface TemplateLinkIconDescriptor {
  icon: unknown;
  label: string;
}

export interface TemplateIconMatch {
  icon: Icon;
  usedFallback: boolean;
}

const ICON_ALIASES_BY_LABEL: Record<string, readonly string[]> = {
  홈페이지: ["university", "home"],
  공지사항: ["bellring", "bell"],
  ecampus: ["ecampus", "book"],
  위인전: ["trophy"],
  수강신청: ["clock"],
  캠퍼스맵: ["mappinned", "map"],
  학사정보시스템: ["graduationcap", "graduation"],
  상허기념도서관: ["bookcopy", "library"],
  학사일정: ["calendardays", "calendar"],
  학식메뉴: ["utensils"],
  에브리타임: ["에브리타임", "alarm"],
  학과정보: ["usersround", "users"],
  쿨하우스: ["bed"],
  kung: ["messagecirclemore", "message"],
  게시판: ["scrolltext", "scroll"],
  현장실습: ["building"],
  창업지원: ["lightbulb"],
};

const normalizeIconName = (value: string) =>
  value.toLowerCase().replace(/\s+/gu, "");

function getIconIdentifier(linkItem: TemplateLinkIconDescriptor): string {
  if (
    (typeof linkItem.icon === "function" ||
      (typeof linkItem.icon === "object" && linkItem.icon !== null))
  ) {
    const icon = linkItem.icon as {
      displayName?: string;
      name?: string;
    };
    const name = icon.displayName || icon.name;
    if (name) return normalizeIconName(name);
  }

  return normalizeIconName(linkItem.label);
}

export function matchTemplateIcon(
  linkItem: TemplateLinkIconDescriptor,
  icons: readonly Icon[],
  genericIconName: string,
): TemplateIconMatch | null {
  if (icons.length === 0) return null;

  const label = normalizeIconName(linkItem.label);
  const genericName = normalizeIconName(genericIconName);
  const candidates = new Set([
    getIconIdentifier(linkItem),
    label,
    ...(ICON_ALIASES_BY_LABEL[label] ?? []),
  ]);
  const normalizedIcons = icons.map((icon) => ({
    icon,
    name: normalizeIconName(icon.name),
  }));
  const matchableIcons = normalizedIcons.filter(
    ({ name }) => name !== genericName,
  );

  const exactMatch = matchableIcons.find(({ name }) => candidates.has(name));
  if (exactMatch) {
    return { icon: exactMatch.icon, usedFallback: false };
  }

  const partialMatch = matchableIcons.find(({ name }) =>
    [...candidates].some(
      (candidate) =>
        candidate.length > 2 &&
        (name.includes(candidate) || candidate.includes(name)),
    ),
  );
  if (partialMatch) {
    return { icon: partialMatch.icon, usedFallback: false };
  }

  const genericIcon = normalizedIcons.find(({ name }) => name === genericName);
  return {
    icon: genericIcon?.icon ?? icons[0],
    usedFallback: true,
  };
}
