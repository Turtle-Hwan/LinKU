"use client";

import { useState } from "react";
import type { LinkuUserSettings } from "@/lib/workspace-store";

interface SettingsPanelProps {
  initialSettings: LinkuUserSettings;
}

export function SettingsPanel({ initialSettings }: SettingsPanelProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function saveSettings(nextSettings: LinkuUserSettings) {
    setPending(true);
    setMessage("");

    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(nextSettings),
      });

      const data = (await response.json()) as LinkuUserSettings;

      if (!response.ok) {
        throw new Error("Unable to save settings.");
      }

      setSettings(data);
      setMessage("Settings saved.");
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "Unable to save settings.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="space-y-6"
      onSubmit={async (event) => {
        event.preventDefault();
        await saveSettings(settings);
      }}
    >
      <label className="flex items-center justify-between rounded-[1.2rem] border border-black/8 bg-white p-5">
        <div>
          <div className="font-medium">Open saved links in a new tab</div>
          <div className="mt-1 text-sm text-[var(--muted)]">
            Keep personal link launches separate from your current task.
          </div>
        </div>
        <input
          type="checkbox"
          checked={settings.openLinksInNewTab}
          onChange={(event) =>
            setSettings((current) => ({
              ...current,
              openLinksInNewTab: event.target.checked,
            }))
          }
        />
      </label>

      <label className="flex items-center justify-between rounded-[1.2rem] border border-black/8 bg-white p-5">
        <div>
          <div className="font-medium">Weekly digest placeholder</div>
          <div className="mt-1 text-sm text-[var(--muted)]">
            Reserve a setting for summary-style notifications or review flows later.
          </div>
        </div>
        <input
          type="checkbox"
          checked={settings.weeklyDigest}
          onChange={(event) =>
            setSettings((current) => ({
              ...current,
              weeklyDigest: event.target.checked,
            }))
          }
        />
      </label>

      <label className="block rounded-[1.2rem] border border-black/8 bg-white p-5">
        <div className="font-medium">Default landing route</div>
        <div className="mt-1 text-sm text-[var(--muted)]">
          Choose the page you want to treat as your signed-in home inside the same app.
        </div>
        <input
          value={settings.defaultLandingRoute}
          onChange={(event) =>
            setSettings((current) => ({
              ...current,
              defaultLandingRoute: event.target.value,
            }))
          }
          className="mt-4 w-full rounded-full border border-black/10 px-4 py-3 text-sm"
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-[#132a22] px-5 py-3 text-sm text-white disabled:opacity-50"
        >
          Save settings
        </button>
        {message ? <p className="text-sm text-[var(--muted)]">{message}</p> : null}
      </div>
    </form>
  );
}
