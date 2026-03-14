"use client";

import { useState } from "react";
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

      const data = (await response.json()) as FavoriteItem[];

      if (!response.ok) {
        throw new Error("Unable to save favorite.");
      }

      setItems(data);
      setTitle("");
      setPath("");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to save favorite.");
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

      const data = (await response.json()) as FavoriteItem[];

      if (!response.ok) {
        throw new Error("Unable to remove favorite.");
      }

      setItems(data);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to remove favorite.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <form
        className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"
        onSubmit={async (event) => {
          event.preventDefault();
          await addFavorite(title, path);
        }}
      >
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Favorite title"
          className="rounded-full border border-black/10 bg-white px-4 py-3 text-sm"
        />
        <input
          value={path}
          onChange={(event) => setPath(event.target.value)}
          placeholder="/services/ecampus"
          className="rounded-full border border-black/10 bg-white px-4 py-3 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-[#132a22] px-5 py-3 text-sm text-white disabled:opacity-50"
        >
          Add favorite
        </button>
      </form>

      {error ? (
        <p className="rounded-[1rem] border border-[#d18d7b] bg-[#fff3ef] px-4 py-3 text-sm text-[#8a3d2c]">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.path}
            type="button"
            onClick={async () => addFavorite(suggestion.title, suggestion.path)}
            className="rounded-full border border-black/10 px-4 py-2 text-sm"
          >
            Add {suggestion.title}
          </button>
        ))}
      </div>

      <div className="grid gap-4">
        {items.length === 0 ? (
          <p className="rounded-[1.2rem] border border-dashed border-black/15 bg-white/60 p-5 text-sm leading-7 text-[var(--muted)]">
            No favorites yet. Save the routes you want to revisit without leaving the same canonical domain.
          </p>
        ) : (
          items.map((item) => (
            <article
              key={item.id}
              className="flex flex-col gap-4 rounded-[1.2rem] border border-black/8 bg-white p-5 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <h3 className="text-lg font-medium">{item.title}</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">{item.path}</p>
              </div>
              <button
                type="button"
                onClick={async () => removeFavorite(item.id)}
                className="rounded-full border border-black/10 px-4 py-2 text-sm"
              >
                Remove
              </button>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
