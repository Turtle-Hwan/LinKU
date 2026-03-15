import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { translateTopNavLinks } from "@/lib/site";

interface SiteShellProps {
  children: React.ReactNode;
  locale: AppLocale;
}

export async function SiteShell({ children, locale }: SiteShellProps) {
  const t = await getTranslations({ locale });
  const topNavLinks = translateTopNavLinks(t);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#d8f279_0,rgba(216,242,121,0.22)_22%,transparent_48%),linear-gradient(180deg,#f7f2e8_0%,#f4efe3_48%,#efe8d8_100%)] text-[var(--ink)]">
      <header className="sticky top-0 z-40 border-b border-black/5 bg-[rgba(247,242,232,0.82)] backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="font-sans text-xl font-semibold tracking-[-0.04em]">
            LinKU
          </Link>
          <div className="hidden items-center gap-3 md:flex">
            <LocaleSwitcher />
          </div>
          <nav className="hidden items-center gap-4 text-sm text-[var(--muted)] lg:flex">
            {topNavLinks.map((item) => (
              <Link key={item.slug} href={item.path} className="transition hover:text-[var(--ink)]">
                {item.title}
              </Link>
            ))}
            <Link href="/login" className="rounded-full border border-black/10 px-4 py-2 text-[var(--ink)]">
              {t("shell.site.login")}
            </Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-black/5 bg-white/50">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-10 text-sm text-[var(--muted)] md:flex-row md:items-center md:justify-between">
          <p>{t("shell.site.footerBlurb")}</p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/privacy">{t("shell.site.privacy")}</Link>
            <Link href="/updates">{t("shell.site.updates")}</Link>
            <Link href="/faq">{t("shell.site.faq")}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
