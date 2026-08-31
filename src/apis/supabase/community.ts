import { getGoogleAccountId } from "@/apis/supabase/account";
import { getSupabaseClient } from "@/apis/supabase/client";
import {
  toSupabaseAuthError,
  toSupabaseStorageError,
  toSupabaseUserError,
} from "@/apis/supabase/errors";
import { UserFacingError } from "@/errors/userFacingError";
import {
  clearCloudSyncState,
  getActiveSyncAccountId,
  getSyncMetadata,
  replacePublicationMetadata,
  setSyncMetadata,
  syncMetadataKey,
} from "@/storage/account/syncRepository";
import {
  getAssetById,
  saveImportedCloudAsset,
} from "@/storage/templates/assetRepository";
import {
  findTemplateBySyncId,
  importTemplateCopy,
} from "@/storage/templates/repository";
import {
  createCloudTemplateDocument,
  hashPublishedTemplate,
  parsePublishedTemplateSnapshot,
  publishedSnapshotToTemplate,
} from "@/sync/templateDocument";
import type {
  CloudTemplateDocumentV1,
  PublicationSort,
  PublishedTemplateSnapshotV1,
  TemplatePublication,
} from "@/types/account";
import type { Database } from "@/types/supabase";
import type { StoredTemplate } from "@/storage/indexedDb/linkuDatabase";
import { syncAccount } from "@/utils/accountSync";
import { recordBreadcrumb } from "@/monitoring";

type PublicationRow =
  Database["public"]["Tables"]["template_publications"]["Row"];
type BrowseRow =
  Database["public"]["Functions"]["browse_publications"]["Returns"][number];

const PUBLIC_BUCKET = "published-template-assets";

function mapOwnPublication(row: PublicationRow): TemplatePublication {
  return {
    templateId: row.template_id,
    snapshot: parsePublishedTemplateSnapshot(row.snapshot),
    revision: row.revision,
    sourceContentHash: row.source_content_hash,
    authorNickname: row.author_nickname,
    likeCount: row.like_count,
    cloneCount: row.clone_count,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    unpublishedAt: row.unpublished_at,
  };
}

function mapBrowsePublication(row: BrowseRow): TemplatePublication {
  return {
    templateId: row.template_id,
    snapshot: parsePublishedTemplateSnapshot(row.snapshot),
    revision: row.revision,
    authorNickname: row.author_nickname,
    likeCount: row.like_count,
    cloneCount: row.clone_count,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    isLiked: row.is_liked,
  };
}

export async function browsePublications(options: {
  query?: string;
  sort?: PublicationSort;
  offset?: number;
  limit?: number;
} = {}): Promise<TemplatePublication[]> {
  const { data, error } = await getSupabaseClient().rpc("browse_publications", {
    p_query: options.query ?? "",
    p_sort: options.sort ?? "latest",
    p_offset: options.offset ?? 0,
    p_limit: options.limit ?? 12,
  });
  if (error) throw toSupabaseUserError(error, "게시된 템플릿을 불러오지 못했습니다.");
  return data.map(mapBrowsePublication);
}

export async function listOwnPublications(): Promise<TemplatePublication[]> {
  const { data, error } = await getSupabaseClient()
    .from("template_publications")
    .select(
      "template_id, owner_id, snapshot, source_content_hash, revision, author_nickname, like_count, clone_count, published_at, updated_at, unpublished_at",
    );
  if (error) throw toSupabaseUserError(error, "게시 상태를 불러오지 못했습니다.");
  return data.map(mapOwnPublication);
}

function assetHashes(document: CloudTemplateDocumentV1 | PublishedTemplateSnapshotV1) {
  return new Set(
    document.items.flatMap((item) =>
      item.icon.kind === "asset" ? [item.icon.hash] : [],
    ),
  );
}

function publicAssetPath(templateId: string, hash: string): string {
  return `${templateId}/${hash}.webp`;
}

export function getPublishedAssetUrl(templateId: string, hash: string): string {
  return getSupabaseClient().storage
    .from(PUBLIC_BUCKET)
    .getPublicUrl(publicAssetPath(templateId, hash)).data.publicUrl;
}

export function createPublicationPreview(publication: TemplatePublication) {
  return publishedSnapshotToTemplate(
    publication.snapshot,
    async (hash, name) => ({
      numericId: 0,
      name,
      dataUrl: getPublishedAssetUrl(publication.templateId, hash),
    }),
  );
}

async function uploadPublishedAssets(
  templateId: string,
  document: CloudTemplateDocumentV1,
  existingHashes: Set<string>,
): Promise<Set<string>> {
  const hashes = assetHashes(document);
  for (const hash of hashes) {
    if (existingHashes.has(hash)) continue;
    const asset = await getAssetById(hash);
    if (!asset) {
      throw new UserFacingError("게시에 필요한 아이콘을 이 기기에서 찾을 수 없습니다.");
    }
    const { error } = await getSupabaseClient().storage
      .from(PUBLIC_BUCKET)
      .upload(publicAssetPath(templateId, hash), asset.blob, {
        cacheControl: "31536000",
        contentType: "image/webp",
        upsert: true,
      });
    if (error) {
      throw toSupabaseStorageError(error, "게시 아이콘을 올리지 못했습니다.");
    }
  }
  return hashes;
}

async function removeUnreferencedPublicAssets(
  templateId: string,
  activeHashes: Set<string>,
): Promise<void> {
  const bucket = getSupabaseClient().storage.from(PUBLIC_BUCKET);
  while (true) {
    const { data, error } = await bucket.list(templateId, { limit: 100 });
    if (error) {
      throw toSupabaseStorageError(error, "게시 아이콘을 정리하지 못했습니다.");
    }
    const stale = data
      .map((file) => file.name)
      .filter((name) => name.endsWith(".webp"))
      .filter((name) => !activeHashes.has(name.slice(0, -".webp".length)))
      .map((name) => `${templateId}/${name}`);
    if (stale.length === 0) return;
    const { error: removeError } = await bucket.remove(stale);
    if (removeError) {
      throw toSupabaseStorageError(removeError, "게시 아이콘을 정리하지 못했습니다.");
    }
  }
}

async function savePublicationMetadata(
  publication: TemplatePublication,
  isPublished: boolean,
): Promise<void> {
  const accountId = await getActiveSyncAccountId();
  if (!accountId) return;
  const key = syncMetadataKey(accountId, "template", publication.templateId);
  const metadata = await getSyncMetadata(key);
  await setSyncMetadata({
    ...metadata,
    key,
    publicationRevision: publication.revision,
    publishedContentHash: publication.sourceContentHash,
    isPublished,
  });
}

export async function refreshPublicationMetadata(): Promise<
  Map<string, TemplatePublication>
> {
  const publications = await listOwnPublications();
  const active = new Map<string, TemplatePublication>();
  for (const publication of publications) {
    if (!publication.unpublishedAt) {
      active.set(publication.templateId, publication);
    }
  }
  const accountId = await getActiveSyncAccountId();
  if (accountId) {
    await replacePublicationMetadata(
      accountId,
      publications.map((publication) => ({
        templateId: publication.templateId,
        revision: publication.revision,
        contentHash: publication.sourceContentHash,
        isPublished: !publication.unpublishedAt,
      })),
    );
  }
  return active;
}

export async function publishLocalTemplate(
  templateId: string,
): Promise<TemplatePublication> {
  const syncResult = await syncAccount();
  if (syncResult.failed > 0) {
    throw new UserFacingError(
      syncResult.firstError ?? "로컬 변경을 먼저 동기화해 주세요.",
    );
  }
  const activePublications = await refreshPublicationMetadata();

  const stored = await findTemplateBySyncId(templateId);
  if (!stored) throw new UserFacingError("이 기기에서 템플릿을 찾을 수 없습니다.");
  const document = await createCloudTemplateDocument(stored);
  const previousPublication = activePublications.get(templateId);
  const previousHashes = previousPublication
    ? assetHashes(previousPublication.snapshot)
    : new Set<string>();

  const accountId = await getActiveSyncAccountId();
  if (!accountId) throw new UserFacingError("Google 로그인이 필요합니다.");
  const metadata = await getSyncMetadata(
    syncMetadataKey(accountId, "template", templateId),
  );
  let hashes: Set<string>;
  let publication: TemplatePublication;
  try {
    hashes = await uploadPublishedAssets(templateId, document, previousHashes);
    const { data, error } = await getSupabaseClient().rpc("publish_template", {
      p_template_id: templateId,
      p_expected_revision: metadata?.publicationRevision,
    });
    if (error) throw toSupabaseUserError(error, "템플릿을 게시하지 못했습니다.");
    publication = mapOwnPublication(data);
  } catch (error) {
    try {
      await removeUnreferencedPublicAssets(templateId, previousHashes);
    } catch {
      recordBreadcrumb(
        "community.publish",
        "failed upload cleanup was unavailable",
        undefined,
        "warning",
      );
    }
    throw error;
  }

  try {
    await savePublicationMetadata(publication, true);
  } catch {
    recordBreadcrumb(
      "community.publish",
      "published metadata will be refreshed later",
      undefined,
      "warning",
    );
  }
  try {
    await removeUnreferencedPublicAssets(templateId, hashes);
  } catch {
    recordBreadcrumb(
      "community.publish",
      "stale public asset cleanup was unavailable",
      undefined,
      "warning",
    );
  }
  return publication;
}

export async function unpublishLocalTemplate(
  templateId: string,
): Promise<void> {
  await refreshPublicationMetadata();
  const accountId = await getActiveSyncAccountId();
  if (!accountId) throw new UserFacingError("Google 로그인이 필요합니다.");
  const metadata = await getSyncMetadata(
    syncMetadataKey(accountId, "template", templateId),
  );
  if (!metadata?.publicationRevision) {
    throw new UserFacingError("게시 상태를 다시 확인해 주세요.");
  }

  const { data, error } = await getSupabaseClient().rpc("unpublish_template", {
    p_template_id: templateId,
    p_expected_revision: metadata.publicationRevision,
  });
  if (error) throw toSupabaseUserError(error, "게시를 내리지 못했습니다.");
  try {
    await savePublicationMetadata(mapOwnPublication(data), false);
  } catch {
    recordBreadcrumb(
      "community.unpublish",
      "unpublished metadata will be refreshed later",
      undefined,
      "warning",
    );
  }
  try {
    await removeUnreferencedPublicAssets(templateId, new Set());
  } catch {
    recordBreadcrumb(
      "community.unpublish",
      "public asset cleanup was unavailable",
      undefined,
      "warning",
    );
  }
}

export async function setPublicationLiked(
  templateId: string,
  liked: boolean,
): Promise<number> {
  const { data, error } = await getSupabaseClient().rpc("set_publication_liked", {
    p_template_id: templateId,
    p_liked: liked,
  });
  if (error) throw toSupabaseUserError(error, "좋아요를 저장하지 못했습니다.");
  return data;
}

async function resolvePublicAsset(templateId: string, hash: string, name: string) {
  const existing = await getAssetById(hash);
  if (existing) return existing;
  const { data, error } = await getSupabaseClient().storage
    .from(PUBLIC_BUCKET)
    .download(publicAssetPath(templateId, hash));
  if (error) {
    throw toSupabaseStorageError(error, "게시 아이콘을 내려받지 못했습니다.");
  }
  return saveImportedCloudAsset(name, data, hash);
}

export async function clonePublication(
  publication: TemplatePublication,
): Promise<number> {
  const template = await publishedSnapshotToTemplate(
    publication.snapshot,
    (hash, name) => resolvePublicAsset(publication.templateId, hash, name),
  );
  const stored = await importTemplateCopy(template);

  void recordSignedInClone(publication.templateId);
  return stored.template.templateId;
}

async function recordSignedInClone(templateId: string): Promise<void> {
  try {
    if (!(await getGoogleAccountId())) return;
    const { error } = await getSupabaseClient().rpc(
      "record_publication_clone",
      { p_template_id: templateId },
    );
    if (error) {
      recordBreadcrumb(
        "community.clone",
        "clone counter was not recorded",
        undefined,
        "warning",
      );
    }
  } catch {
    recordBreadcrumb(
      "community.clone",
      "clone counter request was unavailable",
      undefined,
      "warning",
    );
  }
}

export async function isPublicationOutdated(
  stored: StoredTemplate,
  publishedContentHash?: string,
): Promise<boolean> {
  if (!publishedContentHash) return false;
  const document = await createCloudTemplateDocument(stored);
  return (await hashPublishedTemplate(document)) !== publishedContentHash;
}

async function removeStorageFolder(
  bucketName: string,
  folder: string,
): Promise<void> {
  const bucket = getSupabaseClient().storage.from(bucketName);
  while (true) {
    const { data, error } = await bucket.list(folder, { limit: 100 });
    if (error) {
      throw toSupabaseStorageError(error, "클라우드 아이콘을 정리하지 못했습니다.");
    }
    const paths = data.map((file) => `${folder}/${file.name}`);
    if (paths.length === 0) return;
    const { error: removeError } = await bucket.remove(paths);
    if (removeError) {
      throw toSupabaseStorageError(removeError, "클라우드 아이콘을 정리하지 못했습니다.");
    }
  }
}

export async function clearLinkuCloudData(): Promise<void> {
  const client = getSupabaseClient();
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) {
    throw toSupabaseAuthError(sessionError, "계정 정보를 불러오지 못했습니다.");
  }
  const userId = sessionData.session?.user.id;
  if (!userId) throw new UserFacingError("Google 로그인이 필요합니다.");

  const { data: templates, error: templatesError } = await client
    .from("templates")
    .select("id");
  if (templatesError) {
    throw toSupabaseUserError(
      templatesError,
      "클라우드 템플릿 목록을 불러오지 못했습니다.",
    );
  }

  const publications = await listOwnPublications();
  for (const publication of publications) {
    if (publication.unpublishedAt) continue;
    const { error: unpublishError } = await client.rpc("unpublish_template", {
      p_template_id: publication.templateId,
      p_expected_revision: publication.revision,
    });
    if (unpublishError) {
      throw toSupabaseUserError(
        unpublishError,
        "게시물을 비공개로 전환하지 못했습니다.",
      );
    }
  }

  await removeStorageFolder("template-assets", userId);
  for (const template of templates) {
    await removeStorageFolder(PUBLIC_BUCKET, template.id);
  }

  const { error } = await client.rpc("clear_linku_data");
  if (error) throw toSupabaseUserError(error, "LinKU 클라우드 데이터를 삭제하지 못했습니다.");
  await clearCloudSyncState();
}
