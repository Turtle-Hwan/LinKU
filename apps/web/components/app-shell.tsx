import type { Session } from "next-auth";
import { getTranslations } from "next-intl/server";
import { Button } from "@linku/ui";
import { signOut } from "@/auth";
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
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex flex-col gap-4 rounded-[1.8rem] border border-white/10 bg-white/8 p-6 shadow-[0_24px_80px_rgba(6,16,12,0.35)] backdrop-blur md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-white/55">
            {t("shell.app.eyebrow")}
          </p>
          <h1 className="mt-2 text-3xl tracking-[-0.04em] text-white">{userName}</h1>
          <p className="mt-2 text-sm leading-6 text-white/70">
            {t("shell.app.summary")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <LocaleSwitcher />
          <form action={handleSignOut}>
            <Button type="submit" variant="secondary" className="rounded-full">
              {t("shell.app.signOut")}
            </Button>
          </form>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="rounded-[1.8rem] border border-white/10 bg-white/8 p-5 backdrop-blur">
          <p className="mb-4 text-xs uppercase tracking-[0.24em] text-white/55">
            {t("shell.app.workspace")}
          </p>
          <nav className="space-y-2">
            {appNavLinks.map((item) => (
              <Link
                key={item.slug}
                href={item.path}
                className="block rounded-[1rem] border border-white/8 px-4 py-3 text-sm text-white/78 transition hover:border-white/18 hover:text-white"
              >
                <div className="font-medium">{item.title}</div>
                <div className="mt-1 text-xs leading-5 text-white/50">{item.summary}</div>
              </Link>
            ))}
          </nav>
        </aside>

        <div className="rounded-[1.8rem] border border-white/10 bg-[#f7f2e8] p-6 text-[var(--ink)] shadow-[0_24px_80px_rgba(6,16,12,0.35)]">
          {children}
        </div>
      </div>
    </div>
  );
}
