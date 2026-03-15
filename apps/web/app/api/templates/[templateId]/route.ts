import { proxyLinkuTemplateRequest } from "@/lib/linku-template-proxy";

export async function GET(
  _request: Request,
  context: { params: Promise<{ templateId: string }> },
) {
  const { templateId } = await context.params;

  return proxyLinkuTemplateRequest(`/templates/${templateId}`, {
    method: "GET",
  });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ templateId: string }> },
) {
  const { templateId } = await context.params;
  const body = (await request.json()) as Record<string, unknown>;

  return proxyLinkuTemplateRequest(`/templates/${templateId}`, {
    method: "PUT",
    body,
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ templateId: string }> },
) {
  const { templateId } = await context.params;

  return proxyLinkuTemplateRequest(`/templates/${templateId}`, {
    method: "DELETE",
  });
}
