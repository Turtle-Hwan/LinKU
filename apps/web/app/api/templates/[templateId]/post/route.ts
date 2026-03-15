import { proxyLinkuTemplateRequest } from "@/lib/linku-template-proxy";

export async function POST(
  _request: Request,
  context: { params: Promise<{ templateId: string }> },
) {
  const { templateId } = await context.params;

  return proxyLinkuTemplateRequest(`/templates/${templateId}/post`, {
    method: "POST",
    body: {},
  });
}
