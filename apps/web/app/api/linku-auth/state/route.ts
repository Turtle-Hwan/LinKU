import { NextResponse } from "next/server";
import { getLinkuBackendSnapshot } from "@/lib/linku-backend";

export async function GET() {
  return NextResponse.json(await getLinkuBackendSnapshot());
}
