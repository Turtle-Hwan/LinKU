import type { NextRequest } from "next/server";
import { proxyLinkuTemplateRequest } from "@/lib/linku-template-proxy";

export async function GET(request: NextRequest) {
  return proxyLinkuTemplateRequest(`/posted-templates/my${request.nextUrl.search}`, {
    method: "GET",
  });
}
