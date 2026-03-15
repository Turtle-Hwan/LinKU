"use client";

import { Button, Input } from "@linku/ui";
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
      ko: "LinKU backend 계정이 연결되었습니다.",
      en: "The LinKU backend account is connected.",
    },
    "guest-connected": {
      ko: "게스트 계정이 연결되었습니다. 건국대 메일 인증 후 다시 연결하면 회원 권한이 적용됩니다.",
      en: "A guest account is connected. Verify your Konkuk email and reconnect to activate member access.",
    },
    "missing-config": {
      ko: "LINKU_API_BASE_URL이 비어 있어 backend 연결을 시작할 수 없습니다.",
      en: "LINKU_API_BASE_URL is missing, so the backend connection cannot start.",
    },
    "oauth-error": {
      ko: "Google OAuth 과정에서 연결이 중단되었습니다.",
      en: "The Google OAuth flow was interrupted.",
    },
    "missing-code": {
      ko: "OAuth callback code가 없어 backend 연결을 완료하지 못했습니다.",
      en: "The backend connection could not finish because the OAuth callback code was missing.",
    },
    "connect-failed": {
      ko: "LinKU backend 토큰 교환에 실패했습니다.",
      en: "The LinKU backend token exchange failed.",
    },
  };

  return messages[status]?.[locale] || "";
}

function getBaseMessage(state: LinkuBackendSnapshot, locale: AppLocale) {
  if (!state.configured) {
    return locale === "ko"
      ? "web에서도 extension과 같은 서버형 기능을 쓰려면 LINKU_API_BASE_URL이 필요합니다."
      : "Set LINKU_API_BASE_URL to unlock the same server-backed flows on the web.";
  }

  if (!state.connected) {
    return locale === "ko"
      ? "template 게시, 학과 구독, 내 알림 같은 extension 서버 기능을 web에서 쓰려면 LinKU backend를 연결하세요."
      : "Connect the LinKU backend to use server-backed template sharing and department subscriptions on the web.";
  }

  if (state.mode === "guest") {
    return locale === "ko"
      ? "현재는 게스트 상태입니다. 건국대 메일 인증 후 다시 연결하면 회원 전용 기능까지 사용할 수 있습니다."
      : "The current backend connection is still a guest session. Verify your Konkuk email and reconnect for member-only features.";
  }

  return locale === "ko"
    ? "extension에서 쓰던 서버형 계정 흐름이 web에도 연결되었습니다."
    : "The same server-backed account flow from the extension is now connected on the web.";
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
            ? "backend 연결을 해제하지 못했습니다."
            : "Failed to disconnect the backend session.",
        );
      }

      await refreshState();
      setMessage(
        locale === "ko"
          ? "LinKU backend 연결을 해제했습니다."
          : "The LinKU backend connection has been cleared.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : locale === "ko"
            ? "backend 연결 해제 중 오류가 발생했습니다."
            : "An error occurred while disconnecting the backend session.",
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
    <article className="rounded-[1.4rem] border border-black/8 bg-white p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
        {locale === "ko" ? "LinKU backend" : "LinKU backend"}
      </p>
      <h2 className="mt-3 text-2xl tracking-[-0.04em]">
        {state.connected
          ? state.mode === "member"
            ? locale === "ko"
              ? "회원 연결 완료"
              : "Member connection ready"
            : locale === "ko"
              ? "게스트 연결 완료"
              : "Guest connection ready"
          : locale === "ko"
            ? "extension 서버 기능 연결"
            : "Connect extension backend features"}
      </h2>
      <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
        {getBaseMessage(state, locale)}
      </p>

      <div className="mt-4 space-y-2 text-sm text-[var(--muted)]">
        <p>
          {locale === "ko" ? "설정 여부" : "Configured"}:{" "}
          {state.configured
            ? locale === "ko"
              ? "예"
              : "Yes"
            : locale === "ko"
              ? "아니오"
              : "No"}
        </p>
        <p>
          {locale === "ko" ? "연결 상태" : "Connection"}:{" "}
          {state.connected
            ? state.mode === "member"
              ? locale === "ko"
                ? "member"
                : "member"
              : locale === "ko"
                ? "guest"
                : "guest"
            : locale === "ko"
              ? "미연결"
              : "disconnected"}
        </p>
        {state.kuMail ? (
          <p>
            {locale === "ko" ? "건국대 메일" : "Konkuk email"}: {state.kuMail}
          </p>
        ) : null}
        {state.connectedAt ? (
          <p>
            {locale === "ko" ? "연결 시각" : "Connected at"}: {state.connectedAt}
          </p>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Button
          type="button"
          className="rounded-full"
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
            className="rounded-full"
            onClick={() => void disconnect()}
            disabled={pending}
          >
            {locale === "ko" ? "연결 해제" : "Disconnect"}
          </Button>
        ) : null}
      </div>

      {state.connected && state.mode === "guest" ? (
        <div className="mt-6 space-y-3 rounded-[1.1rem] border border-dashed border-black/10 bg-[#f6f0e1] p-4">
          <h3 className="text-lg tracking-[-0.03em]">
            {locale === "ko" ? "건국대 메일 인증" : "Konkuk email verification"}
          </h3>
          <Input
            value={kuMail}
            onChange={(event) => setKuMail(event.target.value)}
            placeholder={
              locale === "ko" ? "example@konkuk.ac.kr" : "example@konkuk.ac.kr"
            }
            className="rounded-full bg-white"
          />
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="secondary"
              className="rounded-full"
              onClick={() => void sendVerificationCode()}
              disabled={pending}
            >
              {locale === "ko" ? "인증 코드 보내기" : "Send code"}
            </Button>
          </div>
          <Input
            value={authCode}
            onChange={(event) => setAuthCode(event.target.value)}
            placeholder={locale === "ko" ? "6자리 인증 코드" : "6-digit code"}
            className="rounded-full bg-white"
          />
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => void verifyCode()}
            disabled={pending}
          >
            {locale === "ko" ? "인증 확인" : "Verify code"}
          </Button>
        </div>
      ) : null}

      {message ? (
        <p className="mt-4 rounded-[1rem] border border-[#b0c38f] bg-[#eff8df] p-4 text-sm text-[#30411e]">
          {message}
        </p>
      ) : null}
    </article>
  );
}
