import type { NextRequest } from "next/server";
import { proxyLinkuTemplateRequest } from "@/lib/linku-template-proxy";

export async function GET(request: NextRequest) {
  return proxyLinkuTemplateRequest(`/templates/cloned${request.nextUrl.search}`, {
    method: "GET",
  });
}
