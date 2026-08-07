"use client";

import { Suspense, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { cn } from "@linku/ui";
import { usePathname } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";

function getInternalPathname(pathname: string) {
  for (const candidate of routing.locales) {
    if (pathname === `/${candidate}`) {
      return "/";
    }

    if (pathname.startsWith(`/${candidate}/`)) {
      return pathname.slice(candidate.length + 1);
    }
  }

  return pathname;
}

function LocaleSwitcherContent() {
  const t = useTranslations();
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function handleLocaleChange(nextLocale: AppLocale) {
    if (nextLocale === locale) {
      return;
    }

    const search = searchParams.toString();
    const internalPathname = getInternalPathname(pathname);
    const localizedPathname =
      nextLocale === routing.defaultLocale
        ? internalPathname
        : internalPathname === "/"
          ? `/${nextLocale}`
          : `/${nextLocale}${internalPathname}`;
    const href = search ? `${localizedPathname}?${search}` : localizedPathname;

    startTransition(() => {
      window.location.assign(href);
    });
  }

  return (
    <div
      className="inline-flex h-8 items-center gap-1 rounded-lg bg-muted p-[3px] text-xs text-muted-foreground"
      aria-label={t("common.switchLanguage")}
    >
      {routing.locales.map((candidate) => {
        const active = candidate === locale;

        return (
          <button
            key={candidate}
            type="button"
            disabled={isPending && active}
            onClick={() => handleLocaleChange(candidate)}
            className={cn(
              "h-[calc(100%-1px)] rounded-md px-2.5 py-1 transition-colors",
              active
                ? "bg-white text-foreground shadow-sm"
                : "hover:bg-white hover:text-foreground",
            )}
          >
            {t(`common.locale.${candidate}`)}
          </button>
        );
      })}
    </div>
  );
}

function LocaleSwitcherFallback() {
  const t = useTranslations();
  const locale = useLocale() as AppLocale;

  return (
    <div
      className="inline-flex h-8 items-center gap-1 rounded-lg bg-muted p-[3px] text-xs text-muted-foreground"
      aria-label={t("common.switchLanguage")}
    >
      {routing.locales.map((candidate) => {
        const active = candidate === locale;

        return (
          <span
            key={candidate}
            className={cn(
              "h-[calc(100%-1px)] rounded-md px-2.5 py-1",
              active ? "bg-white text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            {t(`common.locale.${candidate}`)}
          </span>
        );
      })}
    </div>
  );
}

export function LocaleSwitcher() {
  return (
    <Suspense fallback={<LocaleSwitcherFallback />}>
      <LocaleSwitcherContent />
    </Suspense>
  );
}
