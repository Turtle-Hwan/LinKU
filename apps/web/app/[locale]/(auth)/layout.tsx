import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Button } from "@linku/ui";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Link } from "@/i18n/navigation";
import { resolveAppLocale } from "@/lib/intl";

export default async function AuthLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: localeParam } = await params;
  const locale = resolveAppLocale(localeParam);
  const t = await getTranslations({ locale });

  return (
    <div className="min-h-screen bg-white text-foreground">
      <header className="border-b bg-white">
        <div className="mx-auto flex min-h-[60px] max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" aria-label="LinKU home">
            <Image src="/brand/linku-logo.svg" alt="LinKU" width={112} height={36} priority />
          </Link>
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <div className="hidden sm:block">
              <LocaleSwitcher />
            </div>
            <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
              <Link href="/guides/install-extension">{t("shell.auth.guide")}</Link>
            </Button>
            <Button asChild size="sm" className="bg-main text-white hover:bg-hover">
              <Link href="/install">{t("shell.auth.install")}</Link>
            </Button>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
