import { hasLocale } from "next-intl";
import { getPathname } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";

export function isAppLocale(value: string): value is AppLocale {
  return hasLocale(routing.locales, value);
}

export function resolveAppLocale(value: string): AppLocale {
  return isAppLocale(value) ? value : routing.defaultLocale;
}

export async function resolveRouteParams<T extends { locale?: string }>(
  params?: Promise<T>,
): Promise<Omit<T, "locale"> & { locale: AppLocale }> {
  const resolved = (await params) ?? ({} as T);

  return {
    ...resolved,
    locale: resolveAppLocale(resolved.locale ?? routing.defaultLocale),
  } as Omit<T, "locale"> & { locale: AppLocale };
}

export function getLocalizedPathname(path: string, locale: AppLocale) {
  return getPathname({
    href: path,
    locale,
  });
}

export function getLocaleAlternates(path: string) {
  const languages = Object.fromEntries(
    routing.locales.map((locale) => [locale, getLocalizedPathname(path, locale)]),
  ) as Record<AppLocale, string>;

  return {
    ...languages,
    "x-default": getLocalizedPathname(path, routing.defaultLocale),
  };
}

export function getLocalizedPublicPaths(paths: string[]) {
  return routing.locales.flatMap((locale) =>
    paths.map((path) => getLocalizedPathname(path, locale)),
  );
}
