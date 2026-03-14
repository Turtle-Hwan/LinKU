import Link from "next/link";
import type { Session } from "next-auth";
import { APP_NAV_LINKS } from "@linku/core";
import { Button } from "@linku/ui";
import { signOut } from "@/auth";

interface AppShellProps {
  session: Session;
  children: React.ReactNode;
}

export function AppShell({ session, children }: AppShellProps) {
  const userName = session.user?.name || session.user?.email || "LinKU account";

  async function handleSignOut() {
    "use server";

    await signOut({ redirectTo: "/" });
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex flex-col gap-4 rounded-[1.8rem] border border-white/10 bg-white/8 p-6 shadow-[0_24px_80px_rgba(6,16,12,0.35)] backdrop-blur md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-white/55">Authenticated surface</p>
          <h1 className="mt-2 text-3xl tracking-[-0.04em] text-white">{userName}</h1>
          <p className="mt-2 text-sm leading-6 text-white/70">
            Signed in on the same canonical domain used by the public SEO surface.
          </p>
        </div>

        <form action={handleSignOut}>
          <Button type="submit" variant="secondary" className="rounded-full">
            Sign out
          </Button>
        </form>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="rounded-[1.8rem] border border-white/10 bg-white/8 p-5 backdrop-blur">
          <p className="mb-4 text-xs uppercase tracking-[0.24em] text-white/55">Workspace</p>
          <nav className="space-y-2">
            {APP_NAV_LINKS.map((item) => (
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
