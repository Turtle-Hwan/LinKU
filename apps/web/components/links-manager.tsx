"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { PersonalLinkItem } from "@/lib/workspace-store";

interface LinksManagerProps {
  initialItems: PersonalLinkItem[];
}

export function LinksManager({ initialItems }: LinksManagerProps) {
  const t = useTranslations();
  const [items, setItems] = useState(initialItems);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function addLink(nextLabel: string, nextUrl: string) {
    setPending(true);
    setError("");

    try {
      const response = await fetch("/api/links", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          label: nextLabel,
          url: nextUrl,
        }),
      });

      const data = (await response.json()) as PersonalLinkItem[] | { message?: string };

      if (!response.ok) {
        throw new Error(
          "message" in data && typeof data.message === "string"
            ? t(data.message)
            : t("components.linksManager.saveError"),
        );
      }

      setItems(data as PersonalLinkItem[]);
      setLabel("");
      setUrl("");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : t("components.linksManager.saveError"),
      );
    } finally {
      setPending(false);
    }
  }

  async function removeLink(id: string) {
    setPending(true);
    setError("");

    try {
      const response = await fetch("/api/links", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });

      const data = (await response.json()) as PersonalLinkItem[] | { message?: string };

      if (!response.ok) {
        throw new Error(
          "message" in data && typeof data.message === "string"
            ? t(data.message)
            : t("components.linksManager.removeError"),
        );
      }

      setItems(data as PersonalLinkItem[]);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : t("components.linksManager.removeError"),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <form
        className="grid gap-3 md:grid-cols-[1fr_1.4fr_auto]"
        onSubmit={async (event) => {
          event.preventDefault();
          await addLink(label, url);
        }}
      >
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder={t("components.linksManager.labelPlaceholder")}
          className="rounded-full border border-black/10 bg-white px-4 py-3 text-sm"
        />
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder={t("components.linksManager.urlPlaceholder")}
          className="rounded-full border border-black/10 bg-white px-4 py-3 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-[#132a22] px-5 py-3 text-sm text-white disabled:opacity-50"
        >
          {t("components.linksManager.save")}
        </button>
      </form>

      {error ? (
        <p className="rounded-[1rem] border border-[#d18d7b] bg-[#fff3ef] px-4 py-3 text-sm text-[#8a3d2c]">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4">
        {items.length === 0 ? (
          <p className="rounded-[1.2rem] border border-dashed border-black/15 bg-white/60 p-5 text-sm leading-7 text-[var(--muted)]">
            {t("components.linksManager.empty")}
          </p>
        ) : (
          items.map((item) => (
            <article
              key={item.id}
              className="flex flex-col gap-4 rounded-[1.2rem] border border-black/8 bg-white p-5 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <h3 className="text-lg font-medium">{item.label}</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">{item.url}</p>
              </div>
              <button
                type="button"
                onClick={async () => removeLink(item.id)}
                className="rounded-full border border-black/10 px-4 py-2 text-sm"
              >
                {t("components.linksManager.remove")}
              </button>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
