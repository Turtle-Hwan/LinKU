import { z } from "zod";
import {
  GENERIC_LINK_ICON_NAME,
  getBundledTemplateIcons,
} from "@/constants/templateIcons";
import {
  GRID_COLUMNS,
  GRID_ROWS,
  MAX_SITE_URL_LENGTH,
  MAX_TEMPLATE_ITEMS,
  MAX_TEMPLATE_NAME_LENGTH,
  UNSAVED_TEMPLATE_ID,
} from "@/constants/template";
import {
  getAssetById,
  getAssetByNumericId,
  saveAssetFromDataUrl,
} from "@/storage/templates/assetRepository";
import { resolveBundledIconReference } from "@/storage/templates/iconReference";
import type { StoredAsset, StoredTemplate } from "@/storage/indexedDb/linkuDatabase";
import type {
  CloudTemplateDocumentV1,
  CloudTemplateIcon,
  CloudTemplateItem,
  PublishedTemplateSnapshotV1,
} from "@/types/account";
import type { Template, TemplateIcon, TemplateItem } from "@/types/api";

export const MAX_CLOUD_TEMPLATE_BYTES = 256 * 1024;
const HASH_PATTERN = /^[0-9a-f]{64}$/u;

const httpUrlSchema = z
  .string()
  .max(MAX_SITE_URL_LENGTH)
  .url()
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "https:" || protocol === "http:";
  });

const iconSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("builtin"),
      key: z.string().trim().min(1).max(MAX_TEMPLATE_NAME_LENGTH),
    })
    .strict(),
  z
    .object({
      kind: z.literal("asset"),
      hash: z.string().regex(HASH_PATTERN),
      name: z.string().trim().min(1).max(MAX_TEMPLATE_NAME_LENGTH),
    })
    .strict(),
]);

const itemSchema = z
  .object({
    templateItemId: z.number().int().min(-2_147_483_648).max(2_147_483_647),
    name: z.string().trim().min(1).max(MAX_TEMPLATE_NAME_LENGTH),
    siteUrl: httpUrlSchema,
    position: z
      .object({
        x: z.number().int().min(0).max(GRID_COLUMNS - 1),
        y: z.number().int().min(0).max(GRID_ROWS - 1),
      })
      .strict(),
    size: z
      .object({
        width: z.number().int().min(1).max(GRID_COLUMNS),
        height: z.number().int().min(1).max(GRID_ROWS),
      })
      .strict(),
    icon: iconSchema,
  })
  .strict()
  .refine((item) => item.templateItemId !== 0)
  .refine((item) => item.position.x + item.size.width <= GRID_COLUMNS);

const commonTemplateSchema = z
  .object({
    version: z.literal(1),
    name: z.string().trim().min(1).max(MAX_TEMPLATE_NAME_LENGTH),
    height: z.number().int().min(1).max(GRID_ROWS),
    items: z.array(itemSchema).max(MAX_TEMPLATE_ITEMS),
  })
  .strict()
  .refine((template) =>
    template.items.every(
      (item) => item.position.y + item.size.height <= template.height,
    ),
  );

export const publishedTemplateSnapshotSchema = commonTemplateSchema;

export const cloudTemplateDocumentSchema = commonTemplateSchema
  .safeExtend({
    cloned: z.boolean(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
    stagingItems: z.array(itemSchema).max(MAX_TEMPLATE_ITEMS),
  })
  .refine((template) =>
    template.stagingItems.every(
      (item) => item.position.y + item.size.height <= template.height,
    ),
  );

export class MissingCloudAssetError extends Error {
  constructor() {
    super("템플릿에 필요한 아이콘을 동기화하지 못했습니다.");
    this.name = "MissingCloudAssetError";
  }
}

function assertDocumentSize(value: unknown): void {
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > MAX_CLOUD_TEMPLATE_BYTES) {
    throw new Error("템플릿 데이터가 256KB를 초과합니다.");
  }
}

function bundledIcon(key: string): TemplateIcon {
  const icons = getBundledTemplateIcons();
  const icon =
    icons.find((candidate) => candidate.name === key) ??
    icons.find((candidate) => candidate.name === GENERIC_LINK_ICON_NAME)!;
  return {
    iconId: icon.id,
    iconName: icon.name,
    iconUrl: icon.imageUrl,
  };
}

async function toCloudIcon(icon: TemplateIcon): Promise<CloudTemplateIcon> {
  const bundled = resolveBundledIconReference(icon, getBundledTemplateIcons());
  if (bundled) return { kind: "builtin", key: bundled.name };

  let asset = await getAssetByNumericId(icon.iconId);
  if (!asset && icon.iconUrl.startsWith("data:image/")) {
    asset = await saveAssetFromDataUrl(icon.iconName, icon.iconUrl);
  }
  return asset
    ? { kind: "asset", hash: asset.id, name: asset.name }
    : { kind: "builtin", key: GENERIC_LINK_ICON_NAME };
}

async function toCloudItem(item: TemplateItem): Promise<CloudTemplateItem> {
  return {
    templateItemId: item.templateItemId,
    name: item.name,
    siteUrl: item.siteUrl,
    position: item.position,
    size: item.size,
    icon: await toCloudIcon(item.icon),
  };
}

export async function createCloudTemplateDocument(
  stored: StoredTemplate,
): Promise<CloudTemplateDocumentV1> {
  const document: CloudTemplateDocumentV1 = {
    version: 1,
    name: stored.template.name,
    height: stored.template.height,
    cloned: stored.template.cloned,
    createdAt: stored.template.createdAt,
    updatedAt: stored.template.updatedAt,
    items: await Promise.all(stored.template.items.map(toCloudItem)),
    stagingItems: await Promise.all(stored.stagingItems.map(toCloudItem)),
  };
  const parsed = cloudTemplateDocumentSchema.parse(document);
  assertDocumentSize(parsed);
  return parsed;
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sortJson(entry)]),
  );
}

export async function hashCloudTemplate(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(sortJson(value)));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function createPublishedSnapshot(
  document: CloudTemplateDocumentV1,
): PublishedTemplateSnapshotV1 {
  return {
    version: 1,
    name: document.name,
    height: document.height,
    items: document.items,
  };
}

export async function hashPublishedTemplate(
  document: CloudTemplateDocumentV1,
): Promise<string> {
  return hashCloudTemplate(createPublishedSnapshot(document));
}

export function parseCloudTemplateDocument(value: unknown): CloudTemplateDocumentV1 {
  assertDocumentSize(value);
  return cloudTemplateDocumentSchema.parse(value);
}

export function parsePublishedTemplateSnapshot(
  value: unknown,
): PublishedTemplateSnapshotV1 {
  assertDocumentSize(value);
  return publishedTemplateSnapshotSchema.parse(value);
}

export type CloudAssetResolver = (
  hash: string,
  name: string,
) => Promise<Pick<StoredAsset, "dataUrl" | "name" | "numericId"> | undefined>;

const resolveLocalAsset: CloudAssetResolver = async (hash) => getAssetById(hash);

async function fromCloudIcon(
  icon: CloudTemplateIcon,
  resolveAsset: CloudAssetResolver,
): Promise<TemplateIcon> {
  if (icon.kind === "builtin") return bundledIcon(icon.key);
  const asset = await resolveAsset(icon.hash, icon.name);
  if (!asset) throw new MissingCloudAssetError();
  return {
    iconId: asset.numericId,
    iconName: asset.name,
    iconUrl: asset.dataUrl,
  };
}

async function fromCloudItem(
  item: CloudTemplateItem,
  resolveAsset: CloudAssetResolver,
): Promise<TemplateItem> {
  return {
    templateItemId: item.templateItemId,
    name: item.name,
    siteUrl: item.siteUrl,
    position: item.position,
    size: item.size,
    icon: await fromCloudIcon(item.icon, resolveAsset),
  };
}

export async function cloudDocumentToTemplate(
  id: string,
  value: unknown,
  resolveAsset: CloudAssetResolver = resolveLocalAsset,
): Promise<{ template: Template; stagingItems: TemplateItem[] }> {
  const document = parseCloudTemplateDocument(value);
  return {
    template: {
      id,
      templateId: UNSAVED_TEMPLATE_ID,
      name: document.name,
      height: document.height,
      cloned: document.cloned,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      items: await Promise.all(
        document.items.map((item) => fromCloudItem(item, resolveAsset)),
      ),
      syncStatus: "synced",
    },
    stagingItems: await Promise.all(
      document.stagingItems.map((item) => fromCloudItem(item, resolveAsset)),
    ),
  };
}

export async function publishedSnapshotToTemplate(
  value: unknown,
  resolveAsset: CloudAssetResolver,
): Promise<Template> {
  const snapshot = parsePublishedTemplateSnapshot(value);
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    templateId: UNSAVED_TEMPLATE_ID,
    name: snapshot.name,
    height: snapshot.height,
    cloned: true,
    createdAt: now,
    updatedAt: now,
    items: await Promise.all(
      snapshot.items.map((item) => fromCloudItem(item, resolveAsset)),
    ),
    syncStatus: "local",
  };
}
