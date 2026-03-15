import { createLinkuBackendJsonResponse } from "@/lib/linku-backend";

export async function POST() {
  return createLinkuBackendJsonResponse(
    {
      connected: false,
    },
    null,
  );
}
