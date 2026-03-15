import { SiteShell } from "@/components/site-shell";
import { resolveAppLocale } from "@/lib/intl";

export default async function MarketingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: localeParam } = await params;
  const locale = resolveAppLocale(localeParam);

  return <SiteShell locale={locale}>{children}</SiteShell>;
}
