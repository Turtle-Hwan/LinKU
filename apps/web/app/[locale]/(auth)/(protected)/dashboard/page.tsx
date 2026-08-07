import { redirect } from "@/i18n/navigation";
import { resolveRouteParams } from "@/lib/intl";

export default async function DashboardPage({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);

  return redirect({ href: "/shortcuts", locale });
}
