"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button, Card, CardContent, Input } from "@linku/ui";
import { Link } from "@/i18n/navigation";
import type { FavoriteItem } from "@/lib/workspace-store";

interface FavoritesManagerProps {
  initialItems: FavoriteItem[];
  suggestions: Array<{
    title: string;
    path: string;
  }>;
}

export function FavoritesManager({
  initialItems,
  suggestions,
}: FavoritesManagerProps) {
  const t = useTranslations();
  const [items, setItems] = useState(initialItems);
  const [title, setTitle] = useState("");
  const [path, setPath] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function addFavorite(nextTitle: string, nextPath: string) {
    setPending(true);
    setError("");

    try {
      const response = await fetch("/api/favorites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: nextTitle,
          path: nextPath,
        }),
      });

      const data = (await response.json()) as FavoriteItem[] | { message?: string };

      if (!response.ok) {
        throw new Error(
          "message" in data && typeof data.message === "string"
            ? t(data.message)
            : t("components.favoritesManager.saveError"),
        );
      }

      setItems(data as FavoriteItem[]);
      setTitle("");
      setPath("");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : t("components.favoritesManager.saveError"),
      );
    } finally {
      setPending(false);
    }
  }

  async function removeFavorite(id: string) {
    setPending(true);
    setError("");

    try {
      const response = await fetch("/api/favorites", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });

      const data = (await response.json()) as FavoriteItem[] | { message?: string };

      if (!response.ok) {
        throw new Error(
          "message" in data && typeof data.message === "string"
            ? t(data.message)
            : t("components.favoritesManager.removeError"),
        );
      }

      setItems(data as FavoriteItem[]);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : t("components.favoritesManager.removeError"),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"
        onSubmit={async (event) => {
          event.preventDefault();
          await addFavorite(title, path);
        }}
      >
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t("components.favoritesManager.titlePlaceholder")}
        />
        <Input
          value={path}
          onChange={(event) => setPath(event.target.value)}
          placeholder={t("components.favoritesManager.pathPlaceholder")}
        />
        <Button
          type="submit"
          disabled={pending}
        >
          {t("components.favoritesManager.add")}
        </Button>
      </form>

      {error ? (
        <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion) => (
          <Button
            key={suggestion.path}
            type="button"
            variant="secondary"
            size="sm"
            onClick={async () => addFavorite(suggestion.title, suggestion.path)}
          >
            {t("components.favoritesManager.quickAddPrefix", {
              title: suggestion.title,
            })}
          </Button>
        ))}
      </div>

      <div className="grid gap-4">
        {items.length === 0 ? (
          <Card size="sm">
            <CardContent className="text-sm leading-7 text-muted-foreground">
              {t("components.favoritesManager.empty")}
            </CardContent>
          </Card>
        ) : (
          items.map((item) => (
            <Card key={item.id} size="sm">
              <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="font-medium">{item.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{item.path}</p>
                </div>
                <div className="flex gap-2">
                  <Button asChild variant="secondary" size="sm">
                    <Link href={item.path}>
                      {t("components.favoritesManager.open")}
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => removeFavorite(item.id)}
                  >
                    {t("components.favoritesManager.remove")}
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
