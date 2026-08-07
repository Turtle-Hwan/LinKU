"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button, Card, CardContent, Input } from "@linku/ui";
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
    <div className="flex flex-col gap-6">
      <form
        className="grid gap-3 md:grid-cols-[1fr_1.4fr_auto]"
        onSubmit={async (event) => {
          event.preventDefault();
          await addLink(label, url);
        }}
      >
        <Input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder={t("components.linksManager.labelPlaceholder")}
        />
        <Input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder={t("components.linksManager.urlPlaceholder")}
        />
        <Button
          type="submit"
          disabled={pending}
        >
          {t("components.linksManager.save")}
        </Button>
      </form>

      {error ? (
        <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4">
        {items.length === 0 ? (
          <Card size="sm">
            <CardContent className="text-sm leading-7 text-muted-foreground">
              {t("components.linksManager.empty")}
            </CardContent>
          </Card>
        ) : (
          items.map((item) => (
            <Card key={item.id} size="sm">
              <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="font-medium">{item.label}</h3>
                  <p className="mt-1 break-all text-sm text-muted-foreground">{item.url}</p>
                </div>
                <div className="flex gap-2">
                  <Button asChild variant="secondary" size="sm">
                    <a href={item.url} target="_blank" rel="noreferrer">
                      {t("components.linksManager.open")}
                    </a>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => removeLink(item.id)}
                  >
                    {t("components.linksManager.remove")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
