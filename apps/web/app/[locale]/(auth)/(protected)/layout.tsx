import type { Metadata } from "next";
import { auth, authRuntime } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { redirect } from "@/i18n/navigation";
import { resolveAppLocale } from "@/lib/intl";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default async function ProtectedLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: localeParam } = await params;
  const locale = resolveAppLocale(localeParam);
  const session = await auth();

  if (!session && authRuntime.googleConfigured) {
    redirect({ href: "/login", locale });
  }

  return <AppShell session={session ?? null} locale={locale}>{children}</AppShell>;
}
