import type { NextRequest } from "next/server";
import { proxyLinkuTemplateRequest } from "@/lib/linku-template-proxy";

export async function GET(request: NextRequest) {
  return proxyLinkuTemplateRequest(
    `/posted-templates/public${request.nextUrl.search}`,
    {
      method: "GET",
      requireWebSession: false,
      requireBackendSession: false,
    },
  );
}
