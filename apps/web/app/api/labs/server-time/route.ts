import { NextResponse } from "next/server";
import { auth } from "@/auth";

const DEFAULT_SERVER_URL = "https://sugang.konkuk.ac.kr";
const KONKUK_HOST = "konkuk.ac.kr";

function normalizeTargetUrl(rawValue: string | null) {
  const fallbackUrl = new URL(DEFAULT_SERVER_URL);
  const targetUrl =
    !rawValue || rawValue.trim().length === 0
      ? fallbackUrl
      : (() => {
          try {
            return new URL(rawValue);
          } catch {
            return null;
          }
        })();

  if (
    !targetUrl ||
    targetUrl.protocol !== "https:" ||
    targetUrl.username ||
    targetUrl.password ||
    (targetUrl.port && targetUrl.port !== "443") ||
    (targetUrl.hostname !== KONKUK_HOST &&
      !targetUrl.hostname.endsWith(`.${KONKUK_HOST}`))
  ) {
    return null;
  }

  return targetUrl;
}

export async function GET(request: Request) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const targetUrl = normalizeTargetUrl(searchParams.get("url"));

  if (!targetUrl) {
    return NextResponse.json(
      { message: "Only HTTPS URLs on konkuk.ac.kr are allowed." },
      { status: 400 },
    );
  }

  const startedAt = Date.now();

  try {
    const response = await fetch(targetUrl, {
      method: "HEAD",
      cache: "no-store",
      redirect: "manual",
    });
    const finishedAt = Date.now();
    const dateHeader = response.headers.get("date");

    if (!dateHeader) {
      return NextResponse.json(
        {
          message: "The target server did not return a Date header.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      sourceUrl: targetUrl.toString(),
      serverTime: dateHeader,
      roundTripMs: finishedAt - startedAt,
      receivedAt: new Date(finishedAt).toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Failed to fetch the server time.",
      },
      { status: 500 },
    );
  }
}
