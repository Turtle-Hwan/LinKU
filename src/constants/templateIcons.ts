import type { Icon } from "@/types/api";
import { LinkList, type LinkListElement } from "@/constants/LinkList";
import { convertLucideIconToDataUri } from "@/utils/template";

let bundledIcons: Icon[] | undefined;

function createIcons(links: LinkListElement[]): Icon[] {
  return links.map((link, index) => ({
    id: index + 1,
    name:
      typeof link.icon === "string"
        ? link.label
        : link.icon.displayName || link.icon.name || link.label,
    imageUrl:
      typeof link.icon === "string"
        ? link.icon
        : convertLucideIconToDataUri(link.icon),
    isDefault: true,
  }));
}

export function getBundledTemplateIcons(
  links: LinkListElement[] = LinkList,
): Icon[] {
  if (links !== LinkList) return createIcons(links);
  bundledIcons ??= createIcons(LinkList);
  return bundledIcons;
}
