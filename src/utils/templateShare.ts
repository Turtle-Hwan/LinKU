import { getBundledTemplateIcons } from "@/constants/templateIcons";
import type { Template, TemplateIcon, TemplateItem } from "@/types/api";
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

function toPortableIcon(icon: TemplateIcon): PortableIcon {
  const builtin = getBundledTemplateIcons().find(
    (candidate) =>
      candidate.id === icon.iconId &&
      candidate.name.toLowerCase() === icon.iconName.toLowerCase(),
  );
  if (builtin) return { kind: "builtin", key: builtin.name };

  if (icon.iconUrl.startsWith("data:image/")) {
    return { kind: "data", name: icon.iconName, dataUrl: icon.iconUrl };
  }

  return { kind: "remote", name: icon.iconName, url: icon.iconUrl };
}

function fromPortableIcon(icon: PortableIcon): TemplateIcon {
  if (icon.kind === "builtin") {
    const bundled = getBundledTemplateIcons().find(
      (candidate) => candidate.name.toLowerCase() === icon.key.toLowerCase(),
    );
    if (!bundled) throw new Error(`알 수 없는 기본 아이콘입니다: ${icon.key}`);
    return {
      iconId: bundled.id,
      iconName: bundled.name,
      iconUrl: bundled.imageUrl,
    };
  }

  return {
    iconId: -Math.floor(Math.random() * Number.MAX_SAFE_INTEGER),
    iconName: icon.name,
    iconUrl: icon.kind === "data" ? icon.dataUrl : icon.url,
  };
}

export function createTemplateSharePayload(
  template: Template,
): TemplateSharePayloadV1 {
  return {
    version: 1,
    template: {
      name: template.name.slice(0, 80),
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
  const url = URL.createObjectURL(
    new Blob([json], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
