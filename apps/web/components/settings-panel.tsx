"use client";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from "@linku/ui";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getLabsCopy } from "@/lib/labs-copy";
import {
  clearECampusCredentials,
  loadECampusCredentials,
  saveECampusCredentials,
} from "@/lib/secure-credentials";

export function SettingsPanel({ locale }: { locale: AppLocale }) {
  const labsCopy = getLabsCopy(locale);
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
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{labsCopy.settings.credentialsTitle}</CardTitle>
          <CardDescription className="leading-7">
            {labsCopy.settings.credentialsBody}
          </CardDescription>
        </CardHeader>

        <CardContent className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              value={studentId}
              onChange={(event) => setStudentId(event.target.value)}
              placeholder={locale === "ko" ? "학번 또는 ID" : "Student ID"}
            />
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={locale === "ko" ? "비밀번호" : "Password"}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void handleSaveCredentials()}>
              {labsCopy.settings.save}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleClearCredentials}
              disabled={!hasSavedCredentials}
            >
              {labsCopy.settings.clear}
            </Button>
          </div>

          {credentialMessage ? (
            <p className="text-sm text-muted-foreground">
              {credentialMessage}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {locale === "ko" ? "템플릿과 보조 도구" : "Templates and tools"}
          </CardTitle>
          <CardDescription className="leading-7">
            {locale === "ko"
              ? "확장 프로그램 설정에서 제공하던 편집기와 Labs 기능을 웹에서도 바로 엽니다."
              : "Open the editor and Labs tools that are also available from extension settings."}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href="/templates">
              {locale === "ko" ? "템플릿" : "Templates"}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/gallery">
              {locale === "ko" ? "갤러리" : "Gallery"}
            </Link>
          </Button>
          <Button asChild>
            <Link href="/labs">{labsCopy.settings.openLabs}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
