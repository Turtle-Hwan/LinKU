import { getSupabaseClient } from "@/apis/supabase/client";
import {
  toSupabaseAuthError,
  toSupabaseStorageError,
  toSupabaseUserError,
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

type TemplateRow = Database["public"]["Tables"]["templates"]["Row"];
type AssetRow = Database["public"]["Tables"]["template_assets"]["Row"];

export interface RemoteAsset {
  contentHash: string;
  name: string;
  objectPath: string;
  byteSize: number;
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
    objectPath: row.object_path,
    byteSize: row.byte_size,
  };
}

export async function listRemoteTemplates(): Promise<RemoteTemplate[]> {
  const { data, error } = await getSupabaseClient()
    .from("templates")
    .select("id, document, content_hash, revision, deleted_at, updated_at")
    .order("updated_at", { ascending: true });
  if (error) throw toSupabaseUserError(error, "템플릿을 동기화하지 못했습니다.");
  return data.map((row) => mapTemplate(row as TemplateRow));
}

export async function getRemoteTemplate(id: string): Promise<RemoteTemplate | null> {
  const { data, error } = await getSupabaseClient()
    .from("templates")
    .select("id, document, content_hash, revision, deleted_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw toSupabaseUserError(error, "템플릿을 동기화하지 못했습니다.");
  return data ? mapTemplate(data as TemplateRow) : null;
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
    .select("content_hash, name, object_path, byte_size, owner_id, created_at");
  if (error) throw toSupabaseUserError(error, "아이콘 목록을 불러오지 못했습니다.");
  return data.map(mapAsset);
}

async function currentUserId(): Promise<string> {
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error) {
    throw toSupabaseAuthError(error, "계정 정보를 불러오지 못했습니다.");
  }
  const userId = data.session?.user.id;
  if (!userId) throw new UserFacingError("Google 로그인이 필요합니다.", "LOGIN_REQUIRED");
  return userId;
}

export async function uploadRemoteAsset(asset: StoredAsset): Promise<RemoteAsset> {
  const client = getSupabaseClient();
  const userId = await currentUserId();
  const objectPath = `${userId}/${asset.id}.webp`;
  const { error: uploadError } = await client.storage
    .from("template-assets")
    .upload(objectPath, asset.blob, {
      cacheControl: "31536000",
      contentType: "image/webp",
      upsert: true,
    });
  if (uploadError) {
    throw toSupabaseStorageError(uploadError, "아이콘을 동기화하지 못했습니다.");
  }

  const { data, error } = await client
    .from("template_assets")
    .upsert(
      {
        content_hash: asset.id,
        name: asset.name,
        object_path: objectPath,
        byte_size: asset.blob.size,
      },
      { onConflict: "owner_id,content_hash" },
    )
    .select("content_hash, name, object_path, byte_size, owner_id, created_at")
    .single();
  if (error) {
    const { data: persisted, error: readbackError } = await client
      .from("template_assets")
      .select("content_hash, name, object_path, byte_size, owner_id, created_at")
      .eq("content_hash", asset.id)
      .maybeSingle();
    if (persisted) return mapAsset(persisted);

    if (!readbackError) {
      const { error: cleanupError } = await client.storage
        .from("template-assets")
        .remove([objectPath]);
      if (!cleanupError) {
        throw toSupabaseUserError(error, "아이콘을 동기화하지 못했습니다.");
      }
      recordBreadcrumb(
        "account.sync",
        "failed private asset cleanup was unavailable",
        undefined,
        "warning",
      );
    }
    throw toSupabaseUserError(error, "아이콘을 동기화하지 못했습니다.");
  }
  return mapAsset(data);
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
