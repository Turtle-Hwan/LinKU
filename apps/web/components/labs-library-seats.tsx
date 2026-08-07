"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from "@linku/ui";
import type { AppLocale } from "@/i18n/routing";
import { getLabsCopy } from "@/lib/labs-copy";
import {
  hasStoredECampusCredentials,
  loadECampusCredentials,
  type SecureCredentials,
} from "@/lib/secure-credentials";

interface LibrarySeatRoom {
  id: number;
  name: string;
  seats: {
    available: number;
    occupied: number;
    total: number;
  };
  reservationUrl: string;
}

export function LabsLibrarySeats({ locale }: { locale: AppLocale }) {
  const copy = getLabsCopy(locale);
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [rooms, setRooms] = useState<LibrarySeatRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fetchedAt, setFetchedAt] = useState("");
  const [savedCredentialState, setSavedCredentialState] = useState<{
    hasSaved: boolean;
    credentials: SecureCredentials | null;
  }>({
    hasSaved: false,
    credentials: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadSavedCredentials() {
      const credentials = await loadECampusCredentials();
      if (cancelled) {
        return;
      }

      setSavedCredentialState({
        hasSaved: hasStoredECampusCredentials(),
        credentials,
      });

      if (credentials) {
        setStudentId(credentials.id);
        setPassword(credentials.password);
      }
    }

    void loadSavedCredentials();

    return () => {
      cancelled = true;
    };
  }, []);

  async function loadSeats(overrideCredentials?: SecureCredentials | null) {
    const credentials =
      overrideCredentials ??
      (studentId.trim() && password
        ? { id: studentId.trim(), password }
        : savedCredentialState.credentials);

    if (!credentials?.id || !credentials.password) {
      setError("eCampus credentials are required to load library seats.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/library/seats", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentId: credentials.id,
          password: credentials.password,
        }),
      });

      const data = (await response.json()) as
        | {
            rooms: LibrarySeatRoom[];
            fetchedAt: string;
          }
        | {
            message?: string;
          };

      if (!response.ok || !("rooms" in data)) {
        throw new Error(
          "message" in data && data.message
            ? data.message
            : "Failed to load library seats.",
        );
      }

      setRooms(data.rooms);
      setFetchedAt(data.fetchedAt);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to load library seats.",
      );
      setRooms([]);
    } finally {
      setLoading(false);
    }
  }

  const updatedAtLabel = useMemo(() => {
    if (!fetchedAt) {
      return "--:--:--";
    }

    return new Date(fetchedAt).toLocaleTimeString(locale === "ko" ? "ko-KR" : "en-US");
  }, [fetchedAt, locale]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.library.title}</CardTitle>
        <CardDescription className="leading-7">
          {copy.library.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="grid gap-5">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <Input
          value={studentId}
          onChange={(event) => setStudentId(event.target.value)}
          aria-label={copy.library.studentId}
          placeholder={copy.library.studentId}
        />
        <Input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-label={copy.library.password}
          placeholder={copy.library.password}
        />
        <Button
          type="button"
          onClick={() => void loadSeats()}
          disabled={loading}
        >
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          {copy.library.fetch}
        </Button>
        </div>

        <div className="grid gap-1 text-sm text-muted-foreground">
          <p>
            {savedCredentialState.hasSaved
              ? copy.library.usingSaved
              : copy.library.noCredentials}
          </p>
          <p>{copy.library.saveHint}</p>
        </div>

      {error ? (
        <p className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {rooms.length === 0 ? (
        <div className="rounded-lg border bg-muted/40 p-5 text-sm text-muted-foreground">
          {copy.library.empty}
        </div>
      ) : (
        <div className="grid gap-3">
          {rooms.map((room) => {
            const ratio = room.seats.total > 0 ? room.seats.available / room.seats.total : 0;
            const countColor =
              ratio > 0.5
                ? "text-primary"
                : ratio > 0.2
                  ? "text-amber-700"
                  : "text-destructive";

            return (
              <article
                key={room.id}
                className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <h3 className="text-lg tracking-[-0.03em]">{room.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {room.seats.occupied}/{room.seats.total}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`text-2xl font-semibold ${countColor}`}>
                    {room.seats.available}
                  </span>
                  <span className="text-sm text-muted-foreground">{copy.library.available}</span>
                  <Button asChild variant="outline" size="sm">
                    <a href={room.reservationUrl} target="_blank" rel="noreferrer">
                      {copy.library.reserve}
                      <ExternalLink className="size-4" />
                    </a>
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="text-sm text-muted-foreground">
        {copy.library.updatedAt}: {updatedAtLabel}
      </div>
      </CardContent>
    </Card>
  );
}
