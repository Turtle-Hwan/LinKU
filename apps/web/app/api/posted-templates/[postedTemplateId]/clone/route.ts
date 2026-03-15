import { proxyLinkuTemplateRequest } from "@/lib/linku-template-proxy";

export async function POST(
  _request: Request,
  context: { params: Promise<{ postedTemplateId: string }> },
) {
  const { postedTemplateId } = await context.params;

  return proxyLinkuTemplateRequest(`/posted-templates/${postedTemplateId}/clone`, {
    method: "POST",
    body: {},
  });
}
