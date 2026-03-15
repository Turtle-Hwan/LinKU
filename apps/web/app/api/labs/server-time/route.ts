import { NextResponse } from "next/server";

const DEFAULT_SERVER_URL = "https://sugang.konkuk.ac.kr";

function normalizeTargetUrl(rawValue: string | null) {
  const fallbackUrl = new URL(DEFAULT_SERVER_URL);
  if (!rawValue || rawValue.trim().length === 0) {
    return fallbackUrl;
  }

  try {
    return new URL(rawValue);
  } catch {
    return fallbackUrl;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = normalizeTargetUrl(searchParams.get("url"));
  const startedAt = Date.now();

  try {
    const response = await fetch(targetUrl, {
      method: "HEAD",
      cache: "no-store",
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
