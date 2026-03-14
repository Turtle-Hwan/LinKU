import { NextResponse } from "next/server";
import { auth, authRuntime } from "@/auth";

export async function GET() {
  const session = await auth();

  if (!session) {
    return NextResponse.json(
      {
        authenticated: false,
        googleConfigured: authRuntime.googleConfigured,
      },
      { status: 401 },
    );
  }

  return NextResponse.json({
    authenticated: true,
    googleConfigured: authRuntime.googleConfigured,
    user: session.user,
  });
}
