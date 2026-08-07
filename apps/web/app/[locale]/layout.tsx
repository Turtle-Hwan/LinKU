import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { LINKU_PRODUCT_NAME } from "@linku/config";
import { routing, type AppLocale } from "@/i18n/routing";
import { resolveRouteParams } from "@/lib/intl";
import { siteEnv } from "@/lib/site";
import "./../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}): Promise<Metadata> {
  const { locale } = await resolveRouteParams(params);

  const t = await getTranslations({ locale, namespace: "layout.meta" });

  return {
    metadataBase: new URL(siteEnv.siteUrl),
    title: {
      default: LINKU_PRODUCT_NAME,
      template: `%s | ${LINKU_PRODUCT_NAME}`,
    },
    description: t("description"),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params?: Promise<{ locale?: string }>;
}>) {
  const resolvedParams = await params;
  const locale = resolvedParams?.locale;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages({ locale });

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider locale={locale as AppLocale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
