import {
  GENERIC_LINK_ICON_NAME,
  getBundledTemplateIcons,
} from "@/constants/templateIcons";
import {
  MAX_TEMPLATE_NAME_LENGTH,
  PORTABLE_ICON_PATTERN,
} from "@/constants/template";
import type { Template, TemplateIcon, TemplateItem } from "@/types/api";
import { downloadBlob } from "@/utils/download";
import type {
  PortableIcon,
  TemplateSharePayloadV1,
} from "@/types/templateShare";
import {
  encodeTemplateSharePayload,
  MAX_SHARE_FILE_BYTES,
  validateTemplateSharePayload,
} from "@/utils/templateShareCodec";

export {
  decodeTemplateSharePayload,
  encodeTemplateSharePayload,
  MAX_SHARE_FILE_BYTES,
  validateTemplateSharePayload,
} from "@/utils/templateShareCodec";

export const SHARE_URL_LIMIT = 1_800;
export const SHARE_PAGE_URL = "https://turtle-hwan.github.io/LinKU/share/";
/** Unregistered icon. The storage layer registers the image on the way in. */
const UNREGISTERED_ICON_ID = 0;

function findBundledIcon(name: string) {
  return getBundledTemplateIcons().find(
    (candidate) => candidate.name.toLowerCase() === name.toLowerCase(),
  );
}

function toBundledTemplateIcon(name: string): TemplateIcon {
  const bundled = findBundledIcon(name) ?? findBundledIcon(GENERIC_LINK_ICON_NAME)!;
  return {
    iconId: bundled.id,
    iconName: bundled.name,
    iconUrl: bundled.imageUrl,
  };
}

function toPortableIcon(icon: TemplateIcon): PortableIcon {
  const bundled = findBundledIcon(icon.iconName);
  if (bundled) return { kind: "builtin", key: bundled.name };

  if (PORTABLE_ICON_PATTERN.test(icon.iconUrl)) {
    return { kind: "data", name: icon.iconName, dataUrl: icon.iconUrl };
  }

  // A remote icon URL is not carried over: rendering a shared template must
  // not send a request to a third-party server.
  return { kind: "builtin", key: GENERIC_LINK_ICON_NAME };
}

function fromPortableIcon(icon: PortableIcon): TemplateIcon {
  return icon.kind === "builtin"
    ? toBundledTemplateIcon(icon.key)
    : {
        iconId: UNREGISTERED_ICON_ID,
        iconName: icon.name,
        iconUrl: icon.dataUrl,
      };
}

export function createTemplateSharePayload(
  template: Template,
): TemplateSharePayloadV1 {
  return {
    version: 1,
    template: {
      name: template.name.slice(0, MAX_TEMPLATE_NAME_LENGTH),
      height: template.height,
      items: template.items.map((item) => ({
        name: item.name,
        siteUrl: item.siteUrl,
        position: item.position,
        size: item.size,
        icon: toPortableIcon(item.icon),
      })),
    },
  };
}

export function portablePayloadToTemplate(
  payload: TemplateSharePayloadV1,
): Template {
  validateTemplateSharePayload(payload);
  const now = new Date().toISOString();
  const items: TemplateItem[] = payload.template.items.map((item, index) => ({
    templateItemId: -(index + 1),
    name: item.name,
    siteUrl: item.siteUrl,
    position: item.position,
    size: item.size,
    icon: fromPortableIcon(item.icon),
  }));
  return {
    id: crypto.randomUUID(),
    templateId: Date.now(),
    name: payload.template.name,
    height: payload.template.height,
    cloned: true,
    items,
    syncStatus: "local",
    createdAt: now,
    updatedAt: now,
  };
}

export async function createTemplateShareUrl(
  template: Template,
): Promise<
  | { mode: "url"; url: string; payload: TemplateSharePayloadV1 }
  | { mode: "file-required"; payload: TemplateSharePayloadV1 }
> {
  const payload = createTemplateSharePayload(template);
  const fragment = await encodeTemplateSharePayload(payload);
  const url = `${SHARE_PAGE_URL}#${fragment}`;
  return url.length <= SHARE_URL_LIMIT
    ? { mode: "url", url, payload }
    : { mode: "file-required", payload };
}

export function downloadTemplatePayload(
  payload: TemplateSharePayloadV1,
  fileName = "linku-template.linku.json",
): void {
  validateTemplateSharePayload(payload);
  const json = JSON.stringify(payload, null, 2);
  if (new TextEncoder().encode(json).byteLength > MAX_SHARE_FILE_BYTES) {
    throw new Error("공유 데이터가 허용된 크기를 초과합니다.");
  }
  downloadBlob(new Blob([json], { type: "application/json" }), fileName);
}
