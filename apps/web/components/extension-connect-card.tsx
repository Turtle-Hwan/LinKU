"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { ExtensionConnectionState } from "@linku/shared-types";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@linku/ui";

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
    <Card>
      <CardHeader>
        <Badge
          variant={connectionState.connected ? "default" : "secondary"}
          className="w-fit"
        >
          {t("components.extensionConnectCard.eyebrow")}
        </Badge>
        <CardTitle>
          {connectionState.connected
            ? t("components.extensionConnectCard.connectedTitle")
            : t("components.extensionConnectCard.disconnectedTitle")}
        </CardTitle>
        <CardDescription className="leading-7">
          {t("components.extensionConnectCard.body")}
        </CardDescription>
      </CardHeader>

      <CardContent className="grid gap-5">
        <div className="grid gap-2">
          <Label htmlFor="extension-id">
          {t("components.extensionConnectCard.extensionId")}
          </Label>
          <Input
            id="extension-id"
            value={extensionId}
            onChange={(event) => setExtensionId(event.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={pending}
            onClick={async () => updateConnection(true)}
          >
            {t("components.extensionConnectCard.markConnected")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={async () => updateConnection(false)}
          >
            {t("components.extensionConnectCard.clearConnection")}
          </Button>
        </div>

        <div className="grid gap-1 rounded-lg border bg-muted/40 p-4 text-sm leading-7 text-muted-foreground">
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

        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </CardContent>
    </Card>
  );
}
