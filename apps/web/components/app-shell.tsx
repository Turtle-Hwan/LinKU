import type { Session } from "next-auth";
import { getTranslations } from "next-intl/server";
import { Button } from "@linku/ui";
import { signOut } from "@/auth";
import { AppPrimaryNavigation } from "@/components/app-primary-navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getLocalizedPathname } from "@/lib/intl";
import { translateAppNavLinks } from "@/lib/site";
import { clearWorkspaceState } from "@/lib/workspace-store";

interface AppShellProps {
  session: Session;
  children: React.ReactNode;
  locale: AppLocale;
}

export async function AppShell({ session, children, locale }: AppShellProps) {
  const t = await getTranslations({ locale });
  const appNavLinks = translateAppNavLinks(t);
  const userName =
    session.user?.name || session.user?.email || t("shell.app.fallbackUserName");

  async function handleSignOut() {
    "use server";
    await clearWorkspaceState();
    await signOut({ redirectTo: getLocalizedPathname("/", locale) });
  }

  return (
    <div className="min-h-[calc(100vh-68px)] bg-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="overflow-hidden rounded-lg border bg-white">
          <header className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">
                {t("shell.app.eyebrow")}
              </p>
              <p className="truncate text-base font-semibold">{userName}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <LocaleSwitcher />
              <Button asChild variant="ghost" size="sm">
                <Link href="/account">
                  {locale === "ko" ? "계정" : "Account"}
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href="/settings">
                  {locale === "ko" ? "설정" : "Settings"}
                </Link>
              </Button>
              <form action={handleSignOut}>
                <Button type="submit" variant="outline" size="sm">
                  {t("shell.app.signOut")}
                </Button>
              </form>
            </div>
          </header>

          <AppPrimaryNavigation
            items={appNavLinks}
            label={t("shell.app.workspace")}
          />

          <main className="min-w-0 border-t p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
