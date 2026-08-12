import type {
  PortableTemplateItem,
  TemplateSharePayloadV1,
} from "../types/templateShare.ts";

export const SHARE_FRAGMENT_PREFIX = "v1.";
export const MAX_SHARE_FILE_BYTES = 256 * 1024;

const MAX_FRAGMENT_CHARACTERS = 4_096;
const DATA_ICON_PATTERN = /^data:image\/(?:png|jpeg|webp);base64,/u;

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary)
    .replace(/\+/gu, "-")
    .replace(/\//gu, "_")
    .replace(/=+$/u, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) {
    throw new Error("공유 링크의 인코딩이 올바르지 않습니다.");
  }
  const base64 = value.replace(/-/gu, "+").replace(/_/gu, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function compress(value: string): Promise<Uint8Array> {
  const stream = new Blob([value])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function decompress(value: Uint8Array): Promise<string> {
  const stream = new Blob([Uint8Array.from(value).buffer])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value: chunk } = await reader.read();
    if (done) break;
    totalBytes += chunk.byteLength;
    if (totalBytes > MAX_SHARE_FILE_BYTES) {
      await reader.cancel();
      throw new Error("공유 데이터가 허용된 크기를 초과합니다.");
    }
    chunks.push(chunk);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function assertHttpUrl(value: string): void {
  if (value.length > 2_048) throw new Error("공유 링크 주소가 너무 깁니다.");
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("공유 템플릿에는 HTTP 또는 HTTPS 링크만 사용할 수 있습니다.");
  }
}

function validatePortableItem(
  value: unknown,
  index: number,
): asserts value is PortableTemplateItem {
  if (!value || typeof value !== "object") {
    throw new Error(`${index + 1}번째 항목이 올바르지 않습니다.`);
  }
  const item = value as Record<string, unknown>;
  if (
    typeof item.name !== "string" ||
    item.name.trim().length === 0 ||
    item.name.length > 80 ||
    typeof item.siteUrl !== "string"
  ) {
    throw new Error(`${index + 1}번째 항목의 이름이나 주소가 올바르지 않습니다.`);
  }
  assertHttpUrl(item.siteUrl);

  const position = item.position as Record<string, unknown> | undefined;
  const size = item.size as Record<string, unknown> | undefined;
  if (
    !position ||
    !size ||
    !Number.isInteger(position.x) ||
    !Number.isInteger(position.y) ||
    !Number.isInteger(size.width) ||
    !Number.isInteger(size.height) ||
    Number(position.x) < 0 ||
    Number(position.y) < 0 ||
    Number(size.width) < 1 ||
    Number(size.height) < 1 ||
    Number(position.x) + Number(size.width) > 6 ||
    Number(position.y) + Number(size.height) > 6
  ) {
    throw new Error(`${index + 1}번째 항목이 템플릿 영역을 벗어납니다.`);
  }

  const icon = item.icon as Record<string, unknown> | undefined;
  if (!icon || !["builtin", "data", "remote"].includes(String(icon.kind))) {
    throw new Error(`${index + 1}번째 항목의 아이콘이 올바르지 않습니다.`);
  }
  if (
    icon.kind === "builtin" &&
    (typeof icon.key !== "string" || icon.key.length === 0 || icon.key.length > 80)
  ) {
    throw new Error(`${index + 1}번째 기본 아이콘이 올바르지 않습니다.`);
  }
  if (icon.kind === "data") {
    if (
      typeof icon.name !== "string" ||
      icon.name.length === 0 ||
      icon.name.length > 80 ||
      typeof icon.dataUrl !== "string" ||
      icon.dataUrl.length > MAX_SHARE_FILE_BYTES ||
      !DATA_ICON_PATTERN.test(icon.dataUrl)
    ) {
      throw new Error(`${index + 1}번째 이미지 아이콘이 올바르지 않습니다.`);
    }
  }
  if (icon.kind === "remote") {
    if (
      typeof icon.name !== "string" ||
      icon.name.length === 0 ||
      icon.name.length > 80 ||
      typeof icon.url !== "string"
    ) {
      throw new Error(`${index + 1}번째 원격 아이콘이 올바르지 않습니다.`);
    }
    assertHttpUrl(icon.url);
  }
}

export function validateTemplateSharePayload(
  value: unknown,
): asserts value is TemplateSharePayloadV1 {
  if (!value || typeof value !== "object") throw new Error("공유 데이터가 없습니다.");
  const payload = value as Record<string, unknown>;
  const template = payload.template as Record<string, unknown> | undefined;
  if (
    payload.version !== 1 ||
    !template ||
    typeof template.name !== "string" ||
    template.name.trim().length === 0 ||
    template.name.length > 80 ||
    !Number.isInteger(template.height) ||
    Number(template.height) < 1 ||
    Number(template.height) > 6 ||
    !Array.isArray(template.items) ||
    template.items.length > 36
  ) {
    throw new Error("지원하지 않는 템플릿 공유 형식입니다.");
  }
  template.items.forEach(validatePortableItem);
}

export async function encodeTemplateSharePayload(
  payload: TemplateSharePayloadV1,
): Promise<string> {
  validateTemplateSharePayload(payload);
  const json = JSON.stringify(payload);
  if (new TextEncoder().encode(json).byteLength > MAX_SHARE_FILE_BYTES) {
    throw new Error("공유 데이터가 허용된 크기를 초과합니다.");
  }
  const compressed = await compress(json);
  return `${SHARE_FRAGMENT_PREFIX}${bytesToBase64Url(compressed)}`;
}

export async function decodeTemplateSharePayload(
  fragment: string,
): Promise<TemplateSharePayloadV1> {
  const normalized = fragment.startsWith("#") ? fragment.slice(1) : fragment;
  if (
    !normalized.startsWith(SHARE_FRAGMENT_PREFIX) ||
    normalized.length > MAX_FRAGMENT_CHARACTERS
  ) {
    throw new Error("지원하지 않는 공유 링크입니다.");
  }
  const json = await decompress(
    base64UrlToBytes(normalized.slice(SHARE_FRAGMENT_PREFIX.length)),
  );
  const payload: unknown = JSON.parse(json);
  validateTemplateSharePayload(payload);
  return payload;
}
