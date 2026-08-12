import { createDefaultLinkList } from "@/constants/LinkList";
import type { BulletinInfo } from "@/constants/bulletin";
import { getBundledTemplateIcons } from "@/constants/templateIcons";
import type { Template } from "@/types/api";
import {
  calculateTemplateHeight,
  convertLinkListToTemplateItems,
} from "@/utils/template";

export function createBundledDefaultTemplate(
  bulletin?: BulletinInfo,
): Template {
  const links = createDefaultLinkList(bulletin);
  const timestamp = "2026-01-01T00:00:00.000Z";
  return {
    id: "builtin:linku-default@1",
    templateId: 0,
    name: "LinKU 기본 템플릿",
    height: calculateTemplateHeight(),
    cloned: false,
    items: convertLinkListToTemplateItems(
      getBundledTemplateIcons(links),
      links,
    ),
    syncStatus: "local",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
