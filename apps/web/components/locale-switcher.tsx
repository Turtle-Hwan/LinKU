"use client";

import { Suspense, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
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
    <div className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white/70 p-1 text-xs text-[var(--muted)]">
      <span className="px-2">{t("common.switchLanguage")}</span>
      {routing.locales.map((candidate) => {
        const active = candidate === locale;

        return (
          <button
            key={candidate}
            type="button"
            disabled={isPending && active}
            onClick={() => handleLocaleChange(candidate)}
            className={`rounded-full px-3 py-1 transition ${
              active
                ? "bg-[#132a22] text-white"
                : "text-[var(--muted)] hover:bg-black/5 hover:text-[var(--ink)]"
            }`}
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
    <div className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white/70 p-1 text-xs text-[var(--muted)]">
      <span className="px-2">{t("common.switchLanguage")}</span>
      {routing.locales.map((candidate) => {
        const active = candidate === locale;

        return (
          <span
            key={candidate}
            className={`rounded-full px-3 py-1 ${
              active ? "bg-[#132a22] text-white" : "text-[var(--muted)]"
            }`}
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
