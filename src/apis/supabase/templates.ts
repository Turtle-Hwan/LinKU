import { getSupabaseClient } from "@/apis/supabase/client";
import { getGoogleAccountId } from "@/apis/supabase/account";
import {
  toSupabaseStorageError,
  toSupabaseUserError,
  SyncConflictError,
} from "@/apis/supabase/errors";
import type { StoredAsset } from "@/storage/indexedDb/linkuDatabase";
import type {
  CloudTemplateDocumentV1,
  RemoteTemplate,
} from "@/types/account";
import type { Database, Json } from "@/types/supabase";
import { parseCloudTemplateDocument } from "@/sync/templateDocument";
import { recordBreadcrumb } from "@/monitoring";
import { UserFacingError } from "@/errors/userFacingError";

type TemplateRow = Omit<
  Database["public"]["Tables"]["templates"]["Row"], "owner_id" | "created_at"
>;
type AssetRow = Pick<
  Database["public"]["Tables"]["template_assets"]["Row"], "content_hash" | "name" | "owner_id" | "revision"
>;

export interface RemoteAsset {
  contentHash: string;
  name: string;
  objectPath: string;
  revision: number;
}

function mapTemplate(row: TemplateRow): RemoteTemplate {
  return {
    id: row.id,
    document: parseCloudTemplateDocument(row.document),
    contentHash: row.content_hash,
    revision: row.revision,
    deletedAt: row.deleted_at,
    updatedAt: row.updated_at,
  };
}

function mapAsset(row: AssetRow): RemoteAsset {
  return {
    contentHash: row.content_hash,
    name: row.name,
    objectPath: `${row.owner_id}/${row.content_hash}.webp`,
    revision: row.revision,
  };
}

export async function listRemoteTemplates(): Promise<RemoteTemplate[]> {
  const { data, error } = await getSupabaseClient()
    .from("templates")
    .select("id, document, content_hash, revision, deleted_at, updated_at")
    .order("updated_at", { ascending: true });
  if (error) throw toSupabaseUserError(error, "템플릿을 동기화하지 못했습니다.");
  return data.map(mapTemplate);
}

export async function getRemoteTemplate(id: string): Promise<RemoteTemplate | null> {
  const { data, error } = await getSupabaseClient()
    .from("templates")
    .select("id, document, content_hash, revision, deleted_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw toSupabaseUserError(error, "템플릿을 동기화하지 못했습니다.");
  return data ? mapTemplate(data) : null;
}

export async function putRemoteTemplate(
  id: string,
  document: CloudTemplateDocumentV1,
  contentHash: string,
  expectedRevision?: number,
): Promise<RemoteTemplate> {
  const { data, error } = await getSupabaseClient().rpc("put_template", {
    p_id: id,
    p_document: document as unknown as Json,
    p_content_hash: contentHash,
    p_expected_revision: expectedRevision,
  });
  if (error) throw toSupabaseUserError(error, "템플릿을 저장하지 못했습니다.");
  return mapTemplate(data);
}

export async function deleteRemoteTemplate(
  id: string,
  expectedRevision: number,
): Promise<RemoteTemplate> {
  const { data, error } = await getSupabaseClient().rpc("delete_template", {
    p_id: id,
    p_expected_revision: expectedRevision,
  });
  if (error) throw toSupabaseUserError(error, "템플릿 삭제를 동기화하지 못했습니다.");
  return mapTemplate(data);
}

export async function listRemoteAssets(): Promise<RemoteAsset[]> {
  const { data, error } = await getSupabaseClient()
    .from("template_assets")
    .select("content_hash, name, owner_id, revision");
  if (error) throw toSupabaseUserError(error, "아이콘 목록을 불러오지 못했습니다.");
  return data.map(mapAsset);
}

export async function getRemoteAsset(contentHash: string): Promise<RemoteAsset | null> {
  const { data, error } = await getSupabaseClient()
    .from("template_assets")
    .select("content_hash, name, owner_id, revision")
    .eq("content_hash", contentHash)
    .maybeSingle();
  if (error) throw toSupabaseUserError(error, "아이콘 정보를 불러오지 못했습니다.");
  return data ? mapAsset(data) : null;
}

export async function putRemoteAsset(
  contentHash: string,
  name: string,
  expectedRevision?: number,
): Promise<RemoteAsset> {
  const { data, error } = await getSupabaseClient().rpc("put_asset", {
    p_content_hash: contentHash,
    p_name: name,
    p_expected_revision: expectedRevision,
  });
  if (error) throw toSupabaseUserError(error, "아이콘 이름을 동기화하지 못했습니다.");
  return mapAsset(data);
}

export async function uploadRemoteAsset(asset: StoredAsset): Promise<RemoteAsset> {
  const client = getSupabaseClient();
  const userId = await getGoogleAccountId();
  if (!userId) throw new UserFacingError("Google 로그인이 필요합니다.", "LOGIN_REQUIRED");
  if (await getRemoteAsset(asset.id)) throw new SyncConflictError();
  const objectPath = `${userId}/${asset.id}.webp`;
  const { error: uploadError } = await client.storage
    .from("template-assets")
    .upload(objectPath, asset.blob, {
      cacheControl: "31536000",
      contentType: "image/webp",
      upsert: false,
    });
  if (uploadError && Number(uploadError.statusCode) !== 409) {
    throw toSupabaseStorageError(uploadError, "아이콘을 동기화하지 못했습니다.");
  }

  try {
    return await putRemoteAsset(asset.id, asset.name);
  } catch (error) {
    // Do not remove a file after an ambiguous response: another request may
    // already have committed its metadata. Storage also enforces this guard.
    const persisted = await getRemoteAsset(asset.id);
    if (persisted?.name === asset.name) return persisted;
    if (!persisted) {
      const { error: cleanupError } = await client.storage
        .from("template-assets")
        .remove([objectPath]);
      if (cleanupError) recordBreadcrumb(
        "account.sync",
        "failed private asset cleanup was unavailable",
        undefined,
        "warning",
      );
    }
    throw error;
  }
}

export async function deleteRemoteAsset(contentHash: string, expectedRevision: number): Promise<void> {
  const client = getSupabaseClient();
  const userId = await getGoogleAccountId();
  if (!userId) throw new UserFacingError("Google 로그인이 필요합니다.", "LOGIN_REQUIRED");
  const { error } = await client.rpc("delete_asset", {
    p_content_hash: contentHash,
    p_expected_revision: expectedRevision,
  });
  if (error) throw toSupabaseUserError(error, "아이콘을 삭제하지 못했습니다.");
  const { error: storageError } = await client.storage
    .from("template-assets")
    .remove([`${userId}/${contentHash}.webp`]);
  if (storageError) throw toSupabaseStorageError(storageError, "아이콘 파일 삭제를 다시 시도합니다.");
  if (await getRemoteAsset(contentHash)) throw new SyncConflictError();
}

export async function downloadRemoteAsset(asset: RemoteAsset): Promise<Blob> {
  const { data, error } = await getSupabaseClient().storage
    .from("template-assets")
    .download(asset.objectPath);
  if (error) {
    throw toSupabaseStorageError(error, "아이콘을 내려받지 못했습니다.");
  }
  return data;
}
