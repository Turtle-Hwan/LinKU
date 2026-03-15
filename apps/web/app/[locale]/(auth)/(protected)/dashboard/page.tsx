import { resolveRouteParams } from "@/lib/intl";
import { WebWorkspace } from "@/components/web-workspace";

export default async function DashboardPage({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);

  return <WebWorkspace locale={locale} />;
}
