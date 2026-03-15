"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { ExtensionConnectionState } from "@linku/shared-types";

interface ExtensionConnectCardProps {
  initialState: ExtensionConnectionState;
  defaultExtensionId: string;
}

export function ExtensionConnectCard({
  initialState,
  defaultExtensionId,
}: ExtensionConnectCardProps) {
  const t = useTranslations();
  const [connectionState, setConnectionState] = useState(initialState);
  const [extensionId, setExtensionId] = useState(
    initialState.extensionId || defaultExtensionId,
  );
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function updateConnection(connected: boolean) {
    setPending(true);
    setMessage("");

    try {
      const response = await fetch("/api/extension/connection", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          connected,
          extensionId,
        }),
      });

      const data = (await response.json()) as ExtensionConnectionState | { message?: string };

      if (!response.ok) {
        throw new Error(
          "message" in data && typeof data.message === "string"
            ? t(data.message)
            : t("components.extensionConnectCard.updateError"),
        );
      }

      setConnectionState(data as ExtensionConnectionState);
      setMessage(
        connected
          ? t("components.extensionConnectCard.connectedMessage")
          : t("components.extensionConnectCard.disconnectedMessage"),
      );
    } catch (caughtError) {
      setMessage(
        caughtError instanceof Error
          ? caughtError.message
          : t("components.extensionConnectCard.updateError"),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-5 rounded-[1.5rem] border border-black/8 bg-white p-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
          {t("components.extensionConnectCard.eyebrow")}
        </p>
        <h2 className="mt-2 text-3xl tracking-[-0.04em]">
          {connectionState.connected
            ? t("components.extensionConnectCard.connectedTitle")
            : t("components.extensionConnectCard.disconnectedTitle")}
        </h2>
        <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
          {t("components.extensionConnectCard.body")}
        </p>
      </div>

      <label className="block">
        <span className="text-sm font-medium">
          {t("components.extensionConnectCard.extensionId")}
        </span>
        <input
          value={extensionId}
          onChange={(event) => setExtensionId(event.target.value)}
          className="mt-2 w-full rounded-full border border-black/10 px-4 py-3 text-sm"
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={async () => updateConnection(true)}
          className="rounded-full bg-[#132a22] px-5 py-3 text-sm text-white disabled:opacity-50"
        >
          {t("components.extensionConnectCard.markConnected")}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={async () => updateConnection(false)}
          className="rounded-full border border-black/10 px-5 py-3 text-sm disabled:opacity-50"
        >
          {t("components.extensionConnectCard.clearConnection")}
        </button>
      </div>

      <div className="rounded-[1.2rem] border border-black/8 bg-[#f6f0e1] p-5 text-sm leading-7 text-[var(--muted)]">
        <p>
          {t("components.extensionConnectCard.connectedLabel")}:{" "}
          {connectionState.connected ? t("common.yes") : t("common.no")}
        </p>
        <p>
          {t("components.extensionConnectCard.extensionId")}:{" "}
          {connectionState.extensionId ||
            t("components.extensionConnectCard.notSet")}
        </p>
        <p>
          {t("components.extensionConnectCard.lastChecked")}:{" "}
          {connectionState.lastCheckedAt ||
            t("components.extensionConnectCard.notRecorded")}
        </p>
      </div>

      {message ? <p className="text-sm text-[var(--muted)]">{message}</p> : null}
    </div>
  );
}
