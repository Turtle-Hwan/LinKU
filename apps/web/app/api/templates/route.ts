import { proxyLinkuTemplateRequest } from "@/lib/linku-template-proxy";

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;

  return proxyLinkuTemplateRequest("/templates", {
    method: "POST",
    body,
  });
}
