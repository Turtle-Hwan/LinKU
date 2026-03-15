"use client";

import { Button, Input } from "@linku/ui";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getLabsCopy } from "@/lib/labs-copy";
import {
  clearECampusCredentials,
  loadECampusCredentials,
  saveECampusCredentials,
} from "@/lib/secure-credentials";
import type { LinkuUserSettings } from "@/lib/workspace-store";

interface SettingsPanelProps {
  initialSettings: LinkuUserSettings;
  locale: AppLocale;
}

export function SettingsPanel({ initialSettings, locale }: SettingsPanelProps) {
  const t = useTranslations();
  const labsCopy = getLabsCopy(locale);
  const [settings, setSettings] = useState(initialSettings);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [credentialMessage, setCredentialMessage] = useState("");
  const [hasSavedCredentials, setHasSavedCredentials] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function readSavedCredentials() {
      const credentials = await loadECampusCredentials();
      if (cancelled) {
        return;
      }

      if (credentials) {
        setStudentId(credentials.id);
        setPassword(credentials.password);
        setHasSavedCredentials(true);
      }
    }

    void readSavedCredentials();

    return () => {
      cancelled = true;
    };
  }, []);

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

  async function handleSaveCredentials() {
    if (!studentId.trim() || !password) {
      setCredentialMessage(
        locale === "ko"
          ? "학번 또는 ID와 비밀번호를 모두 입력해 주세요."
          : "Enter both the student ID and password.",
      );
      return;
    }

    await saveECampusCredentials({
      id: studentId.trim(),
      password,
    });

    setHasSavedCredentials(true);
    setCredentialMessage(labsCopy.settings.saved);
  }

  function handleClearCredentials() {
    clearECampusCredentials();
    setHasSavedCredentials(false);
    setPassword("");
    setCredentialMessage(labsCopy.settings.cleared);
  }

  return (
    <div className="space-y-8">
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

      <section className="rounded-[1.2rem] border border-black/8 bg-white p-5">
        <div className="space-y-2">
          <h2 className="text-xl tracking-[-0.03em]">{labsCopy.settings.credentialsTitle}</h2>
          <p className="text-sm leading-7 text-[var(--muted)]">
            {labsCopy.settings.credentialsBody}
          </p>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Input
            value={studentId}
            onChange={(event) => setStudentId(event.target.value)}
            placeholder={locale === "ko" ? "학번 또는 ID" : "Student ID"}
            className="rounded-full bg-[#f6f0e1]"
          />
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={locale === "ko" ? "비밀번호" : "Password"}
            className="rounded-full bg-[#f6f0e1]"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Button type="button" className="rounded-full" onClick={() => void handleSaveCredentials()}>
            {labsCopy.settings.save}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={handleClearCredentials}
            disabled={!hasSavedCredentials}
          >
            {labsCopy.settings.clear}
          </Button>
        </div>

        {credentialMessage ? (
          <p className="mt-3 text-sm text-[var(--muted)]">{credentialMessage}</p>
        ) : null}
      </section>

      <section className="rounded-[1.2rem] border border-black/8 bg-white p-5">
        <div className="space-y-2">
          <h2 className="text-xl tracking-[-0.03em]">
            {locale === "ko" ? "빠른 이동" : "Quick access"}
          </h2>
          <p className="text-sm leading-7 text-[var(--muted)]">
            {locale === "ko"
              ? "extension 설정 창에서 열던 편집기와 보조 도구를 web에서도 같은 경로로 엽니다."
              : "Open the editor flows and utility tools from the same web surface."}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Button asChild variant="secondary" className="rounded-full">
            <Link href="/templates">{locale === "ko" ? "템플릿" : "Templates"}</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/gallery">{locale === "ko" ? "갤러리" : "Gallery"}</Link>
          </Button>
          <Button asChild className="rounded-full">
            <Link href="/labs">{labsCopy.settings.openLabs}</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
