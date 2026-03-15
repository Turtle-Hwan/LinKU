import { proxyLinkuTemplateRequest } from "@/lib/linku-template-proxy";

export async function GET() {
  return proxyLinkuTemplateRequest("/icons/default", {
    method: "GET",
    requireWebSession: false,
    requireBackendSession: false,
  });
}
