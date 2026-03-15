import { proxyLinkuTemplateRequest } from "@/lib/linku-template-proxy";

export async function GET(
  _request: Request,
  context: { params: Promise<{ postedTemplateId: string }> },
) {
  const { postedTemplateId } = await context.params;

  return proxyLinkuTemplateRequest(`/posted-templates/${postedTemplateId}`, {
    method: "GET",
    requireWebSession: false,
    requireBackendSession: false,
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ postedTemplateId: string }> },
) {
  const { postedTemplateId } = await context.params;

  return proxyLinkuTemplateRequest(`/posted-templates/${postedTemplateId}`, {
    method: "DELETE",
  });
}
