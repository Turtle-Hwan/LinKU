"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from "@linku/ui";
import { useState } from "react";
import type { AppLocale } from "@/i18n/routing";

interface LinkuBackendSnapshot {
  configured: boolean;
  connected: boolean;
  mode: "disconnected" | "guest" | "member";
  kuMail?: string;
  connectedAt?: string;
}

interface LinkuBackendConnectionCardProps {
  locale: AppLocale;
  initialState: LinkuBackendSnapshot;
  initialStatus?: string;
}

function getStatusMessage(status: string | undefined, locale: AppLocale) {
  if (!status) {
    return "";
  }

  const messages: Record<string, { ko: string; en: string }> = {
    connected: {
      ko: "LinKU 계정이 연결되었습니다.",
      en: "Your LinKU account is connected.",
    },
    "guest-connected": {
      ko: "게스트 계정이 연결되었습니다. 건국대 메일 인증 후 다시 연결하면 회원 권한이 적용됩니다.",
      en: "A guest account is connected. Verify your Konkuk email and reconnect to activate member access.",
    },
    "missing-config": {
      ko: "계정 연결 기능을 준비 중입니다.",
      en: "Account connection is not available yet.",
    },
    "oauth-error": {
      ko: "Google OAuth 과정에서 연결이 중단되었습니다.",
      en: "The Google OAuth flow was interrupted.",
    },
    "missing-code": {
      ko: "로그인 정보를 확인하지 못해 연결을 완료하지 못했습니다.",
      en: "The connection could not be completed because the sign-in response was missing.",
    },
    "connect-failed": {
      ko: "LinKU 계정 연결에 실패했습니다.",
      en: "The LinKU account connection failed.",
    },
  };

  return messages[status]?.[locale] || "";
}

function getBaseMessage(state: LinkuBackendSnapshot, locale: AppLocale) {
  if (!state.configured) {
    return locale === "ko"
      ? "계정 연결 기능은 현재 준비 중입니다."
      : "Account connection is currently being prepared.";
  }

  if (!state.connected) {
    return locale === "ko"
      ? "계정을 연결하면 템플릿 공유와 학과 알림을 사용할 수 있습니다."
      : "Connect your account to share templates and follow department alerts.";
  }

  if (state.mode === "guest") {
    return locale === "ko"
      ? "건국대 메일 인증을 마치면 모든 계정 기능을 사용할 수 있습니다."
      : "Verify your Konkuk email to use all account features.";
  }

  return locale === "ko"
    ? "계정 연결이 완료되었습니다."
    : "Your account connection is ready.";
}

export function LinkuBackendConnectionCard({
  locale,
  initialState,
  initialStatus,
}: LinkuBackendConnectionCardProps) {
  const [state, setState] = useState(initialState);
  const [kuMail, setKuMail] = useState(initialState.kuMail || "");
  const [authCode, setAuthCode] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState(() =>
    getStatusMessage(initialStatus, locale),
  );

  async function refreshState() {
    const response = await fetch("/api/linku-auth/state");
    const data = (await response.json()) as LinkuBackendSnapshot;
    setState(data);

    if (data.kuMail) {
      setKuMail(data.kuMail);
    }
  }

  function startConnection() {
    const returnTo = `${window.location.pathname}${window.location.search}`;
    window.location.href = `/api/linku-auth/login?returnTo=${encodeURIComponent(returnTo)}`;
  }

  async function disconnect() {
    setPending(true);
    setMessage("");

    try {
      const response = await fetch("/api/linku-auth/logout", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(
          locale === "ko"
            ? "계정 연결을 해제하지 못했습니다."
            : "Failed to disconnect the account.",
        );
      }

      await refreshState();
      setMessage(
        locale === "ko"
          ? "LinKU 계정 연결을 해제했습니다."
          : "The LinKU account has been disconnected.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : locale === "ko"
            ? "계정 연결을 해제하는 중 오류가 발생했습니다."
            : "An error occurred while disconnecting the account.",
      );
    } finally {
      setPending(false);
    }
  }

  async function sendVerificationCode() {
    setPending(true);
    setMessage("");

    try {
      const response = await fetch("/api/linku-auth/send-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ kuMail }),
      });
      const data = (await response.json()) as { message?: string; kuMail?: string };

      if (!response.ok) {
        throw new Error(
          data.message ||
            (locale === "ko"
              ? "인증 코드를 보내지 못했습니다."
              : "Failed to send the verification code."),
        );
      }

      if (data.kuMail) {
        setKuMail(data.kuMail);
      }

      await refreshState();
      setMessage(
        locale === "ko"
          ? "건국대 메일로 인증 코드를 보냈습니다."
          : "A verification code has been sent to your Konkuk email.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : locale === "ko"
            ? "인증 코드 전송 중 오류가 발생했습니다."
            : "An error occurred while sending the verification code.",
      );
    } finally {
      setPending(false);
    }
  }

  async function verifyCode() {
    setPending(true);
    setMessage("");

    try {
      const response = await fetch("/api/linku-auth/verify-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ kuMail, authCode }),
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(
          data.message ||
            (locale === "ko"
              ? "인증 코드를 확인하지 못했습니다."
              : "Failed to verify the email code."),
        );
      }

      await refreshState();
      setAuthCode("");
      setMessage(
        locale === "ko"
          ? "메일 인증이 완료되었습니다. 다시 연결하면 member 권한이 반영됩니다."
          : "Email verification is complete. Reconnect once to apply member access.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : locale === "ko"
            ? "인증 코드 확인 중 오류가 발생했습니다."
            : "An error occurred while verifying the email code.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <Badge variant={state.connected ? "default" : "secondary"} className="w-fit">
          {state.connected
            ? state.mode === "member"
              ? locale === "ko"
                ? "연결됨"
                : "Connected"
              : locale === "ko"
                ? "메일 인증 필요"
                : "Email verification needed"
            : locale === "ko"
              ? "연결 전"
              : "Not connected"}
        </Badge>
        <CardTitle>{locale === "ko" ? "LinKU 계정 연결" : "Connect your LinKU account"}</CardTitle>
        <CardDescription className="leading-7">
          {getBaseMessage(state, locale)}
        </CardDescription>
      </CardHeader>

      <CardContent className="grid gap-5">
        {state.kuMail ? (
          <p className="text-sm text-muted-foreground">
            {locale === "ko" ? "건국대 메일" : "Konkuk email"} · {state.kuMail}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={startConnection}
            disabled={!state.configured || pending}
          >
            {state.connected
              ? locale === "ko"
                ? "다시 연결"
                : "Reconnect"
              : locale === "ko"
                ? "연결 시작"
                : "Connect now"}
          </Button>
          {state.connected ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => void disconnect()}
              disabled={pending}
            >
              {locale === "ko" ? "연결 해제" : "Disconnect"}
            </Button>
          ) : null}
        </div>

        {state.connected && state.mode === "guest" ? (
          <div className="grid gap-3 rounded-lg border bg-muted/40 p-4">
            <h3 className="font-medium">
              {locale === "ko" ? "건국대 메일 인증" : "Konkuk email verification"}
            </h3>
            <Input
              value={kuMail}
              onChange={(event) => setKuMail(event.target.value)}
              placeholder="example@konkuk.ac.kr"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => void sendVerificationCode()}
              disabled={pending}
            >
              {locale === "ko" ? "인증 코드 보내기" : "Send code"}
            </Button>
            <Input
              value={authCode}
              onChange={(event) => setAuthCode(event.target.value)}
              placeholder={locale === "ko" ? "6자리 인증 코드" : "6-digit code"}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => void verifyCode()}
              disabled={pending}
            >
              {locale === "ko" ? "인증 확인" : "Verify code"}
            </Button>
          </div>
        ) : null}

        {message ? (
          <p className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
            {message}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
