import Image from "next/image";
import { getTranslations } from "next-intl/server";
import {
  FlaskConical,
  Globe,
  Search,
  Settings,
} from "lucide-react";
import { Button, Input } from "@linku/ui";
import { GitHubMark } from "@/components/github-mark";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { siteEnv, translateTopNavLinks } from "@/lib/site";

interface SiteShellProps {
  children: React.ReactNode;
  locale: AppLocale;
}

export async function SiteShell({ children, locale }: SiteShellProps) {
  const t = await getTranslations({ locale });
  const topNavLinks = translateTopNavLinks(t).filter((item) =>
    ["features", "services", "guides", "faq"].includes(item.slug),
  );

  return (
    <div className="min-h-screen bg-white text-foreground">
      <header className="sticky top-0 z-40 border-b bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6 md:flex-nowrap">
          <Link href="/" className="shrink-0 rounded" aria-label="LinKU home">
            <Image
              src="/brand/linku-logo.svg"
              alt="LinKU"
              width={112}
              height={36}
              priority
            />
          </Link>

          <form
            action="https://search.konkuk.ac.kr/main.do"
            method="get"
            target="_blank"
            className="relative order-3 w-full md:order-none md:max-w-xl md:flex-1"
          >
            <Input
              name="keyword"
              type="search"
              placeholder={
                locale === "ko" ? "검색어 입력" : "Search Konkuk University"
              }
              aria-label={
                locale === "ko" ? "건국대학교 통합 검색" : "Search Konkuk University"
              }
              className="w-full py-2 pl-10 pr-4"
            />
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          </form>

          <div className="ml-auto flex shrink-0 items-center gap-1 text-gray-600">
            <div className="hidden xl:block">
              <LocaleSwitcher />
            </div>
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="hidden sm:inline-flex"
            >
              <Link
                href="/labs"
                aria-label={locale === "ko" ? "실험실" : "Labs"}
                title={locale === "ko" ? "실험실" : "Labs"}
              >
                <FlaskConical />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="icon">
              <Link
                href="/login"
                aria-label={t("shell.site.login")}
                title={t("shell.site.login")}
              >
                <Globe />
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="hidden sm:inline-flex"
            >
              <Link
                href="/settings"
                aria-label={locale === "ko" ? "설정" : "Settings"}
                title={locale === "ko" ? "설정" : "Settings"}
              >
                <Settings />
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="hidden sm:inline-flex"
            >
              <a
                href="https://github.com/Turtle-Hwan/LinKU"
                target="_blank"
                rel="noreferrer"
                aria-label="GitHub"
                title="GitHub"
              >
                <GitHubMark className="size-5" />
              </a>
            </Button>
            <Button
              asChild
              size="sm"
              className="ml-1 bg-main text-white hover:bg-hover"
            >
              <a href={siteEnv.extensionUrl} target="_blank" rel="noreferrer">
                {locale === "ko" ? "Chrome에 추가" : "Add to Chrome"}
              </a>
            </Button>
          </div>
        </div>

        <nav
          className="mx-auto max-w-7xl px-3 pb-3 sm:px-5"
          aria-label={locale === "ko" ? "주요 메뉴" : "Main navigation"}
        >
          <div className="grid h-9 grid-cols-4 items-center rounded-lg bg-muted p-[3px] text-sm text-muted-foreground">
            {topNavLinks.map((item) => (
              <Link
                key={item.slug}
                href={item.path}
                className="inline-flex h-[calc(100%-1px)] items-center justify-center rounded-md px-2 py-1 font-medium transition-colors hover:bg-white hover:text-foreground"
              >
                {item.title}
              </Link>
            ))}
          </div>
          <div className="mt-2 flex justify-end xl:hidden">
            <LocaleSwitcher />
          </div>
        </nav>
      </header>

      <main>{children}</main>

      <footer className="border-t bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-end md:justify-between">
          <div>
            <Image src="/brand/linku-logo.svg" alt="LinKU" width={112} height={36} />
            <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
              {t("shell.site.footerBlurb")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <Link href="/privacy">{t("shell.site.privacy")}</Link>
            <Link href="/updates">{t("shell.site.updates")}</Link>
            <Link href="/faq">{t("shell.site.faq")}</Link>
            <a
              href="https://github.com/Turtle-Hwan/LinKU"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
