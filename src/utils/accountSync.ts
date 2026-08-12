import {
  activateSyncAccount,
  getSyncMetadata,
  listSyncOutbox,
  markSyncAttempt,
  removeSyncOutboxEntry,
  setSyncMetadata,
} from "@/storage/linkuDb";
import type {
  ApiResult,
  SyncIndexResponse,
  SyncedTemplateDocumentV1,
} from "@/types/serverless";
import type { TemplateSharePayloadV1 } from "@/types/templateShare";
import {
  findTemplateBySyncId,
  importSharedTemplate,
  removeLocalTemplateWithoutSync,
  saveRemoteTemplate,
} from "@/utils/templateStorage";
import {
  portableItemsToTemplateItems,
  templateItemsToPortable,
} from "@/utils/templateShare";
import { validateTemplateSharePayload } from "@/utils/templateShareCodec";
import {
  ACCOUNT_ID_KEY,
} from "@/utils/authStorage";
import {
  ACCOUNT_API_BASE_URL,
  getValidAccessToken,
} from "@/background/handlers/oauth";

interface SyncPassResult {
  synced: number;
  failed: number;
}

interface PullPassResult {
  pulled: number;
  failed: number;
}

type PutTemplateResult = "synced" | "conflict";

interface RemoteTemplate {
  document: SyncedTemplateDocumentV1;
  etag: string;
}

function isSyncedTemplateDocument(
  value: unknown,
  expectedId: string,
): value is SyncedTemplateDocumentV1 {
  if (!value || typeof value !== "object") return false;
  const document = value as Record<string, unknown>;
  if (
    document.version !== 1 ||
    document.id !== expectedId ||
    typeof document.name !== "string" ||
    typeof document.height !== "number" ||
    typeof document.cloned !== "boolean" ||
    !Array.isArray(document.items) ||
    !Array.isArray(document.stagingItems) ||
    typeof document.createdAt !== "string" ||
    !Number.isFinite(Date.parse(document.createdAt)) ||
    typeof document.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(document.updatedAt))
  ) {
    return false;
  }

  try {
    validateTemplateSharePayload({
      version: 1,
      template: {
        name: document.name,
        height: document.height,
        items: document.items,
      },
    });
    validateTemplateSharePayload({
      version: 1,
      template: {
        name: document.name,
        height: document.height,
        items: document.stagingItems,
      },
    });
    return true;
  } catch {
    return false;
  }
}

function isSyncIndexResponse(value: unknown): value is SyncIndexResponse {
  if (!value || typeof value !== "object") return false;
  const templates = (value as Record<string, unknown>).templates;
  return (
    Array.isArray(templates) &&
    templates.every((entry) => {
      if (!entry || typeof entry !== "object") return false;
      const item = entry as Record<string, unknown>;
      return (
        typeof item.id === "string" &&
        /^[A-Za-z0-9:_-]{1,128}$/u.test(item.id) &&
        typeof item.etag === "string" &&
        typeof item.size === "number" &&
        item.size >= 0 &&
        typeof item.uploadedAt === "string" &&
        Number.isFinite(Date.parse(item.uploadedAt)) &&
        (item.deleted === undefined || typeof item.deleted === "boolean")
      );
    })
  );
}

function metadataKey(accountId: string, resourceId: string): string {
  return `${accountId}:template:${resourceId}`;
}

async function accountId(): Promise<string> {
  const stored = await chrome.storage.local.get(ACCOUNT_ID_KEY);
  const value = stored[ACCOUNT_ID_KEY];
  if (typeof value !== "string") {
    throw new Error("계정 동기화를 사용하려면 로그인해주세요.");
  }
  return value;
}

async function authenticatedFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getValidAccessToken();
  if (!token) throw new Error("계정 동기화를 사용하려면 로그인해주세요.");
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);
  return fetch(`${ACCOUNT_API_BASE_URL}${path}`, { ...init, headers });
}

async function readApiError(response: Response): Promise<string> {
  try {
    const result = (await response.json()) as ApiResult<never>;
    return result.ok ? response.statusText : result.error.message;
  } catch {
    return response.statusText || "계정 서버 요청에 실패했습니다.";
  }
}

function toDocument(
  stored: NonNullable<Awaited<ReturnType<typeof findTemplateBySyncId>>>,
): SyncedTemplateDocumentV1 {
  return {
    version: 1,
    id: stored.template.id,
    name: stored.template.name,
    height: stored.template.height,
    cloned: stored.template.cloned,
    items: templateItemsToPortable(stored.template.items),
    stagingItems: templateItemsToPortable(stored.stagingItems),
    createdAt: stored.template.createdAt,
    updatedAt: stored.template.updatedAt,
  };
}

async function readRemoteTemplate(
  resourceId: string,
): Promise<RemoteTemplate | null> {
  const response = await authenticatedFetch(
    `/sync/v1/templates/${encodeURIComponent(resourceId)}`,
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(await readApiError(response));
  const document: unknown = await response.json();
  if (!isSyncedTemplateDocument(document, resourceId)) {
    throw new Error("계정 서버의 템플릿 데이터가 올바르지 않습니다.");
  }
  const etag = response.headers.get("etag")?.replace(/"/gu, "");
  if (!etag) throw new Error("계정 서버의 변경 식별자가 없습니다.");
  return { document, etag };
}

async function putTemplate(
  currentAccountId: string,
  resourceId: string,
): Promise<PutTemplateResult> {
  const stored = await findTemplateBySyncId(resourceId);
  const outboxKey = `template:${resourceId}`;
  if (!stored) {
    await removeSyncOutboxEntry(outboxKey);
    return "synced";
  }

  const syncKey = metadataKey(currentAccountId, resourceId);
  const metadata = await getSyncMetadata(syncKey);
  const response = await authenticatedFetch(
    `/sync/v1/templates/${encodeURIComponent(resourceId)}`,
    {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        ...(metadata?.etag
          ? { "if-match": `"${metadata.etag}"` }
          : { "if-none-match": "*" }),
      },
      body: JSON.stringify(toDocument(stored)),
    },
  );
  if (response.status === 412) {
    await preserveConflict(currentAccountId, resourceId, stored.template.templateId);
    return "conflict";
  }
  if (!response.ok) throw new Error(await readApiError(response));
  const etag = response.headers.get("etag")?.replace(/"/gu, "");
  await Promise.all([
    setSyncMetadata({
      key: syncKey,
      etag: etag || undefined,
      lastSyncedAt: Date.now(),
    }),
    removeSyncOutboxEntry(outboxKey),
  ]);
  return "synced";
}

async function preserveConflict(
  currentAccountId: string,
  resourceId: string,
  localTemplateId: number,
): Promise<void> {
  const local = await findTemplateBySyncId(resourceId);
  if (!local) return;
  const remote = await readRemoteTemplate(resourceId);
  if (!remote) return;
  await importSharedTemplate(
    { ...local.template, cloned: true },
    local.stagingItems,
    "(충돌 복사본)",
  );
  await saveRemoteTemplate(
    {
      ...local.template,
      id: remote.document.id,
      name: remote.document.name,
      height: remote.document.height,
      cloned: remote.document.cloned,
      items: portableItemsToTemplateItems(remote.document.items),
      createdAt: remote.document.createdAt,
      updatedAt: remote.document.updatedAt,
      syncStatus: "synced",
    },
    portableItemsToTemplateItems(remote.document.stagingItems),
    localTemplateId,
  );
  await Promise.all([
    setSyncMetadata({
      key: metadataKey(currentAccountId, resourceId),
      etag: remote.etag,
      lastSyncedAt: Date.now(),
    }),
    removeSyncOutboxEntry(`template:${resourceId}`),
  ]);
}

async function deleteTemplate(
  currentAccountId: string,
  resourceId: string,
): Promise<void> {
  const outboxKey = `template:${resourceId}`;
  const metadata = await getSyncMetadata(
    metadataKey(currentAccountId, resourceId),
  );
  if (!metadata?.etag) {
    await removeSyncOutboxEntry(outboxKey);
    return;
  }
  const response = await authenticatedFetch(
    `/sync/v1/templates/${encodeURIComponent(resourceId)}`,
    {
      method: "DELETE",
      headers: { "if-match": `"${metadata.etag}"` },
    },
  );
  if (response.status === 412) {
    const remote = await readRemoteTemplate(resourceId);
    if (!remote) {
      await removeSyncOutboxEntry(outboxKey);
      return;
    }
    await importSharedTemplate(
      {
        id: remote.document.id,
        templateId: Date.now(),
        name: remote.document.name,
        height: remote.document.height,
        cloned: true,
        items: portableItemsToTemplateItems(remote.document.items),
        syncStatus: "local",
        createdAt: remote.document.createdAt,
        updatedAt: remote.document.updatedAt,
      },
      portableItemsToTemplateItems(remote.document.stagingItems),
      "(삭제 충돌 복사본)",
    );
    const retry = await authenticatedFetch(
      `/sync/v1/templates/${encodeURIComponent(resourceId)}`,
      {
        method: "DELETE",
        headers: { "if-match": `"${remote.etag}"` },
      },
    );
    if (!retry.ok && retry.status !== 404) {
      throw new Error(await readApiError(retry));
    }
    await removeSyncOutboxEntry(outboxKey);
    return;
  }
  if (!response.ok && response.status !== 404) {
    throw new Error(await readApiError(response));
  }
  await removeSyncOutboxEntry(outboxKey);
}

async function pushLocalChanges(
  currentAccountId: string,
): Promise<SyncPassResult> {
  const entries = await listSyncOutbox();
  let synced = 0;
  let failed = 0;
  for (const entry of entries) {
    try {
      if (entry.operation === "delete") {
        await deleteTemplate(currentAccountId, entry.resourceId);
        synced += 1;
      } else {
        const result = await putTemplate(currentAccountId, entry.resourceId);
        if (result === "conflict") {
          failed += 1;
        } else {
          synced += 1;
        }
      }
    } catch (error) {
      failed += 1;
      await markSyncAttempt(
        entry.key,
        metadataKey(currentAccountId, entry.resourceId),
        error instanceof Error ? error.message : "동기화 실패",
      );
    }
  }
  return { synced, failed };
}

async function pullRemoteTemplates(
  currentAccountId: string,
): Promise<PullPassResult> {
  const response = await authenticatedFetch("/sync/v1/index");
  if (!response.ok) throw new Error(await readApiError(response));
  const result = (await response.json()) as ApiResult<unknown>;
  if (!result.ok) throw new Error(result.error.message);
  if (!isSyncIndexResponse(result.data)) {
    throw new Error("계정 서버의 동기화 목록이 올바르지 않습니다.");
  }
  const outbox = await listSyncOutbox();
  let pulled = 0;
  let failed = 0;

  for (const remote of result.data.templates) {
    try {
      const syncKey = metadataKey(currentAccountId, remote.id);
      const local = await findTemplateBySyncId(remote.id);
      const pending = outbox.find(
        (entry) => entry.key === `template:${remote.id}`,
      );
      if (remote.deleted) {
        if (!local) continue;
        if (pending?.operation === "put") {
          await importSharedTemplate(
            { ...local.template, cloned: true },
            local.stagingItems,
            "(복구본)",
          );
        }
        await removeLocalTemplateWithoutSync(local.template.templateId);
        await removeSyncOutboxEntry(`template:${remote.id}`);
        await setSyncMetadata({
          key: syncKey,
          etag: remote.etag,
          lastSyncedAt: Date.now(),
        });
        pulled += 1;
        continue;
      }

      const metadata = await getSyncMetadata(syncKey);
      if (metadata?.etag === remote.etag || pending) continue;
      const remoteTemplate = await readRemoteTemplate(remote.id);
      if (!remoteTemplate) continue;
      const document = remoteTemplate.document;
      await saveRemoteTemplate(
        {
          id: document.id,
          templateId: local?.template.templateId ?? Date.now(),
          name: document.name,
          height: document.height,
          cloned: document.cloned,
          items: portableItemsToTemplateItems(document.items),
          syncStatus: "synced",
          createdAt: document.createdAt,
          updatedAt: document.updatedAt,
        },
        portableItemsToTemplateItems(document.stagingItems),
        local?.template.templateId,
      );
      await setSyncMetadata({
        key: syncKey,
        etag: remote.etag,
        lastSyncedAt: Date.now(),
      });
      pulled += 1;
    } catch {
      failed += 1;
    }
  }
  return { pulled, failed };
}

export async function syncAccount(): Promise<{
  synced: number;
  failed: number;
  pulled: number;
}> {
  const currentAccountId = await accountId();
  await activateSyncAccount(currentAccountId);
  const pushed = await pushLocalChanges(currentAccountId);
  const pulled = await pullRemoteTemplates(currentAccountId);
  window.dispatchEvent(new CustomEvent("linku:templates-changed"));
  return {
    synced: pushed.synced,
    pulled: pulled.pulled,
    failed: pushed.failed + pulled.failed,
  };
}

export async function createCloudShare(
  payload: TemplateSharePayloadV1,
): Promise<string> {
  const response = await authenticatedFetch("/shares/v1", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await readApiError(response));
  const result = (await response.json()) as ApiResult<{ id: string; url: string }>;
  if (!result.ok) throw new Error(result.error.message);
  return result.data.url;
}

export async function deleteCloudAccount(): Promise<void> {
  const response = await authenticatedFetch("/account", { method: "DELETE" });
  if (!response.ok) throw new Error(await readApiError(response));
}
