"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { LinkuUserSettings } from "@/lib/workspace-store";

interface SettingsPanelProps {
  initialSettings: LinkuUserSettings;
}

export function SettingsPanel({ initialSettings }: SettingsPanelProps) {
  const t = useTranslations();
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

      const data = (await response.json()) as LinkuUserSettings | { message?: string };

      if (!response.ok) {
        throw new Error(
          "message" in data && typeof data.message === "string"
            ? t(data.message)
            : t("components.settingsPanel.saveError"),
        );
      }

      setSettings(data as LinkuUserSettings);
      setMessage(t("components.settingsPanel.saved"));
    } catch (caughtError) {
      setMessage(
        caughtError instanceof Error
          ? caughtError.message
          : t("components.settingsPanel.saveError"),
      );
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
          <div className="font-medium">
            {t("components.settingsPanel.openNewTabTitle")}
          </div>
          <div className="mt-1 text-sm text-[var(--muted)]">
            {t("components.settingsPanel.openNewTabDescription")}
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
          <div className="font-medium">
            {t("components.settingsPanel.weeklyDigestTitle")}
          </div>
          <div className="mt-1 text-sm text-[var(--muted)]">
            {t("components.settingsPanel.weeklyDigestDescription")}
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
        <div className="font-medium">
          {t("components.settingsPanel.defaultLandingTitle")}
        </div>
        <div className="mt-1 text-sm text-[var(--muted)]">
          {t("components.settingsPanel.defaultLandingDescription")}
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
          {t("components.settingsPanel.save")}
        </button>
        {message ? <p className="text-sm text-[var(--muted)]">{message}</p> : null}
      </div>
    </form>
  );
}
