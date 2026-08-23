import { DRAFT_SLOT_KEY, type LinkuDb } from "./linkuDb.ts";
import { parseLegacyTemplateRecord } from "./legacyTemplateRecord.ts";

export const LEGACY_TEMPLATE_PREFIX = "linku_template_";
export const LEGACY_TEMPLATE_INDEX_KEY = "linku_templates_index";
export const LEGACY_DRAFT_KEY = "linku_template_draft";
export const LEGACY_MIGRATION_KEY = "local-storage-templates-v1";

interface LegacyStorageReader {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
}

interface LegacySource {
  key: string;
  raw: string;
  fingerprint: string;
}

export interface LegacyMigrationReport {
  indexError?: unknown;
  repaired: Array<{ key: string; repairs: string[] }>;
  quarantined: Array<{
    key: string;
    kind: "conflict" | "unreadable";
    reason: string;
    templateId?: number;
  }>;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function fingerprint(raw: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(raw),
  );
  return bytesToHex(new Uint8Array(digest));
}

async function readLegacySources(storage: LegacyStorageReader): Promise<{
  templates: LegacySource[];
  draft?: LegacySource;
  indexError?: unknown;
}> {
  const keys = new Set<string>();
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(LEGACY_TEMPLATE_PREFIX) && key !== LEGACY_DRAFT_KEY) {
      keys.add(key);
    }
  }

  let indexError: unknown;
  const legacyIndex = storage.getItem(LEGACY_TEMPLATE_INDEX_KEY);
  if (legacyIndex) {
    try {
      const entries = JSON.parse(legacyIndex) as Array<{ templateId?: number }>;
      for (const entry of entries) {
        if (typeof entry.templateId === "number" && entry.templateId !== 0) {
          keys.add(`${LEGACY_TEMPLATE_PREFIX}${entry.templateId}`);
        }
      }
    } catch (error) {
      indexError = error;
    }
  }

  const templates: LegacySource[] = [];
  for (const key of [...keys].sort()) {
    const raw = storage.getItem(key);
    if (raw === null) continue;
    templates.push({ key, raw, fingerprint: await fingerprint(raw) });
  }

  const draftRaw = storage.getItem(LEGACY_DRAFT_KEY);
  const draft =
    draftRaw === null
      ? undefined
      : {
          key: LEGACY_DRAFT_KEY,
          raw: draftRaw,
          fingerprint: await fingerprint(draftRaw),
        };

  return { templates, draft, indexError };
}

export async function migrateLegacyTemplateStorage(
  database: LinkuDb,
  storage: LegacyStorageReader,
): Promise<LegacyMigrationReport> {
  const snapshot = await readLegacySources(storage);
  const report: LegacyMigrationReport = {
    indexError: snapshot.indexError,
    repaired: [],
    quarantined: [],
  };
  const transaction = database.transaction(
    ["templates", "drafts", "migrations", "quarantine"],
    "readwrite",
  );

  try {
    const migrationStore = transaction.objectStore("migrations");
    const previous = await migrationStore.get(LEGACY_MIGRATION_KEY);
    const previousSources = previous?.legacySources;
    const nextSources: NonNullable<typeof previousSources> = {};
    const templateStore = transaction.objectStore("templates");

    const quarantine = async (
      source: LegacySource,
      reason: string,
      kind: "conflict" | "unreadable",
      templateId?: number,
    ): Promise<void> => {
      await transaction.objectStore("quarantine").put({
        id: crypto.randomUUID(),
        at: { store: "legacy-local-storage", key: source.key },
        reason,
        quarantinedAt: Date.now(),
        raw: source.raw,
      });
      report.quarantined.push({
        key: source.key,
        kind,
        reason,
        templateId,
      });
    };

    for (const source of snapshot.templates) {
      const previousSource = previousSources?.[source.key];
      if (previousSource?.fingerprint === source.fingerprint) {
        nextSources[source.key] = previousSource;
        continue;
      }

      const result = parseLegacyTemplateRecord(source.raw);
      if (!result.ok) {
        await quarantine(source, result.reason, "unreadable");
        nextSources[source.key] = {
          fingerprint: source.fingerprint,
          status: "quarantined",
        };
        continue;
      }

      if (result.repairs.length > 0) {
        report.repaired.push({ key: source.key, repairs: result.repairs });
      }

      const { stored } = result;
      const existing = await templateStore.get(stored.template.templateId);
      if (existing) {
        const wasPreviouslyMigrated = previousSource?.status === "migrated";

        if (wasPreviouslyMigrated) {
          if (stored.metadata.lastSaved > existing.metadata.lastSaved) {
            await templateStore.put(stored, stored.template.templateId);
          } else {
            await quarantine(
              source,
              "IndexedDB 사본이 같거나 더 최신이어서 변경된 이전 원본을 별도로 보관했습니다.",
              "conflict",
              stored.template.templateId,
            );
          }
          nextSources[source.key] = {
            fingerprint: source.fingerprint,
            status: "migrated",
          };
          continue;
        }

        const reason =
          "같은 식별자의 템플릿이 이미 있어 원본을 별도로 보관했습니다.";
        await quarantine(
          source,
          reason,
          "conflict",
          stored.template.templateId,
        );
        nextSources[source.key] = {
          fingerprint: source.fingerprint,
          status: "quarantined",
        };
        continue;
      }

      await templateStore.put(stored, stored.template.templateId);
      nextSources[source.key] = {
        fingerprint: source.fingerprint,
        status: "migrated",
      };
    }

    if (snapshot.draft) {
      const source = snapshot.draft;
      const previousSource = previousSources?.[source.key];
      if (previousSource?.fingerprint === source.fingerprint) {
        nextSources[source.key] = previousSource;
      } else {
        const result = parseLegacyTemplateRecord(source.raw, {
          allowUnsavedTemplateId: true,
        });
        if (result.ok) {
          const existing = await transaction
            .objectStore("drafts")
            .get(DRAFT_SLOT_KEY);
          if (!existing) {
            await transaction
              .objectStore("drafts")
              .put(result.stored, DRAFT_SLOT_KEY);
            nextSources[source.key] = {
              fingerprint: source.fingerprint,
              status: "migrated",
            };
          } else if (previousSource?.status === "migrated") {
            if (result.stored.metadata.lastSaved > existing.metadata.lastSaved) {
              await transaction
                .objectStore("drafts")
                .put(result.stored, DRAFT_SLOT_KEY);
            } else {
              await quarantine(
                source,
                "IndexedDB draft가 같거나 더 최신이어서 변경된 이전 원본을 별도로 보관했습니다.",
                "conflict",
              );
            }
            nextSources[source.key] = {
              fingerprint: source.fingerprint,
              status: "migrated",
            };
          } else {
            await quarantine(
              source,
              "기존 draft의 원본을 확인할 수 없어 이전 원본을 별도로 보관했습니다.",
              "conflict",
            );
            nextSources[source.key] = {
              fingerprint: source.fingerprint,
              status: "quarantined",
            };
          }
        } else {
          await quarantine(source, result.reason, "unreadable");
          nextSources[source.key] = {
            fingerprint: source.fingerprint,
            status: "quarantined",
          };
        }
      }
    }

    await migrationStore.put(
      {
        completedAt: Date.now(),
        legacySources: nextSources,
      },
      LEGACY_MIGRATION_KEY,
    );
    await transaction.done;
    return report;
  } catch (error) {
    try {
      transaction.abort();
    } catch {
      // IndexedDB may already have aborted the transaction.
    }
    throw error;
  }
}
