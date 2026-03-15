import { NextResponse } from "next/server";
import {
  createLinkuBackendJsonResponse,
  getLinkuBackendRuntime,
  readLinkuBackendSession,
  requestLinkuBackend,
} from "@/lib/linku-backend";

export async function POST(request: Request) {
  const runtime = getLinkuBackendRuntime();

  if (!runtime.configured) {
    return NextResponse.json(
      {
        message: "LinKU backend is not configured.",
      },
      { status: 503 },
    );
  }

  const session = await readLinkuBackendSession();

  if (!session) {
    return NextResponse.json(
      {
        message: "LinKU backend connection is required.",
      },
      { status: 401 },
    );
  }

  const body = (await request.json()) as { kuMail?: string };
  const kuMail = body.kuMail?.trim();

  if (!kuMail) {
    return NextResponse.json(
      {
        message: "A Konkuk email address is required.",
      },
      { status: 400 },
    );
  }

  const result = await requestLinkuBackend<null>("/auth/send-code", {
    method: "POST",
    session,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ kuMail }),
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        message: result.message,
      },
      { status: result.status },
    );
  }

  return createLinkuBackendJsonResponse(
    {
      message: "sent",
      kuMail,
    },
    {
      ...session,
      kuMail,
    },
  );
}
