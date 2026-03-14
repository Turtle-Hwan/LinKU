import Link from "next/link";
import { TOP_NAV_LINKS } from "@linku/core";

interface SiteShellProps {
  children: React.ReactNode;
}

export function SiteShell({ children }: SiteShellProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#d8f279_0,rgba(216,242,121,0.22)_22%,transparent_48%),linear-gradient(180deg,#f7f2e8_0%,#f4efe3_48%,#efe8d8_100%)] text-[var(--ink)]">
      <header className="sticky top-0 z-40 border-b border-black/5 bg-[rgba(247,242,232,0.82)] backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="font-sans text-xl font-semibold tracking-[-0.04em]">
            LinKU
          </Link>
          <nav className="hidden items-center gap-4 text-sm text-[var(--muted)] md:flex">
            {TOP_NAV_LINKS.map((item) => (
              <Link key={item.slug} href={item.path} className="transition hover:text-[var(--ink)]">
                {item.title}
              </Link>
            ))}
            <Link href="/login" className="rounded-full border border-black/10 px-4 py-2 text-[var(--ink)]">
              Login
            </Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-black/5 bg-white/50">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-10 text-sm text-[var(--muted)] md:flex-row md:items-center md:justify-between">
          <p>LinKU runs public SEO pages and authenticated entry routes on the same canonical web domain.</p>
          <div className="flex gap-4">
            <Link href="/privacy">Privacy</Link>
            <Link href="/updates">Updates</Link>
            <Link href="/faq">FAQ</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
