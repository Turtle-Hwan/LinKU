import type { Icon } from "@/types/api";
import { LinkList } from "@/constants/LinkList";
import { convertLucideIconToDataUri } from "@/utils/template";

let bundledIcons: Icon[] | undefined;

export function getBundledTemplateIcons(): Icon[] {
  if (!bundledIcons) {
    bundledIcons = LinkList.map((link, index) => ({
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
  return bundledIcons;
}
