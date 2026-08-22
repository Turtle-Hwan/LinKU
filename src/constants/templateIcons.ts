import type { Icon } from "@/types/api";
import { LinkList, type LinkListElement } from "@/constants/LinkList";
import { convertLucideIconToDataUri } from "@/utils/template";

let bundledIcons: Icon[] | undefined;

/**
 * Fallback icon for links whose original image cannot travel — a remote URL
 * that we refuse to re-request from a shared template, or a bundled icon the
 * receiving version no longer has.
 *
 * It is a bundled icon rather than a synthetic placeholder so the editor can
 * resolve it like any other: an item pointing at an icon that no list holds
 * cannot be saved at all.
 */
export const GENERIC_LINK_ICON_NAME = "링크";

export const GENERIC_LINK_ICON_URL = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1-1"/></svg>',
)}`;

function createIcons(links: LinkListElement[]): Icon[] {
  const icons: Icon[] = links.map((link, index) => ({
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

  icons.push({
    id: icons.length + 1,
    name: GENERIC_LINK_ICON_NAME,
    imageUrl: GENERIC_LINK_ICON_URL,
    isDefault: true,
  });

  return icons;
}

export function getBundledTemplateIcons(
  links: LinkListElement[] = LinkList,
): Icon[] {
  if (links !== LinkList) return createIcons(links);
  bundledIcons ??= createIcons(LinkList);
  return bundledIcons;
}
