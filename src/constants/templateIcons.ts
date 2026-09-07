import type { Icon } from "@/types/api";
import {
  LINK_CATALOG,
  type LinkCatalogElement,
} from "@/constants/linkCatalog";
import { convertLucideIconToDataUri } from "@/utils/iconDataUri";

let bundledIcons: Icon[] | undefined;

/**
 * Fallback icon for remote image URLs that are not portable or bundled icons
 * that a newer or older client no longer recognizes.
 *
 * It is a bundled icon rather than a synthetic placeholder so the editor can
 * resolve it like any other: an item pointing at an icon that no list holds
 * cannot be saved at all.
 */
export const GENERIC_LINK_ICON_NAME = "링크";

export const GENERIC_LINK_ICON_URL = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1-1"/></svg>',
)}`;

function createIcons(links: readonly LinkCatalogElement[]): Icon[] {
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
  links: readonly LinkCatalogElement[] = LINK_CATALOG,
): Icon[] {
  if (links !== LINK_CATALOG) return createIcons(links);
  bundledIcons ??= createIcons(LINK_CATALOG);
  return bundledIcons;
}
