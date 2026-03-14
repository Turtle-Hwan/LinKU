import Link from "next/link";
import { Button } from "@linku/ui";
import { createPageMetadata } from "@linku/seo";
import { siteEnv } from "@/lib/site";

export const metadata = createPageMetadata({
  title: "Login",
  description:
    "Enter the authenticated LinKU surface on the same canonical domain used for public SEO pages and install guidance.",
  path: "/login",
  siteUrl: siteEnv.siteUrl,
  index: false,
});

export default function LoginPage() {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-77px)] max-w-5xl items-center px-6 py-16">
      <div className="grid w-full gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-5">
          <p className="text-xs uppercase tracking-[0.24em] text-white/60">Path-based auth entry</p>
          <h1 data-display="true" className="text-6xl leading-[0.95] tracking-[-0.05em]">
            Public pages and account routes now share one canonical domain.
          </h1>
          <p className="max-w-xl text-lg leading-8 text-white/72">
            This route is the stable entry point for Google sign-in, dashboard access, and future per-user settings.
            The next implementation step wires server-side auth and session-aware routes into the same app.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/" className="rounded-full border border-white/20 px-5 py-3 text-sm">
              Back to homepage
            </Link>
            <Link href="/guides/install-extension" className="rounded-full border border-white/20 px-5 py-3 text-sm">
              Read install guide
            </Link>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/8 p-8 shadow-[0_30px_90px_rgba(6,16,12,0.35)] backdrop-blur">
          <p className="mb-3 text-xs uppercase tracking-[0.24em] text-white/60">Account entry</p>
          <h2 className="mb-4 text-4xl tracking-[-0.04em]">Continue with Google</h2>
          <p className="mb-8 text-sm leading-7 text-white/70">
            Auth.js and Google OAuth are wired in the next step. The route, metadata, and noindex policy are already
            in place so the public site can safely link users here now.
          </p>
          <Button disabled className="w-full rounded-full">
            Google sign-in coming next
          </Button>
          <div className="mt-8 rounded-[1.4rem] border border-white/10 bg-black/10 p-5 text-sm leading-7 text-white/72">
            After sign-in, users land in the same app under routes such as /dashboard, /favorites, /settings, and
            /extension/connect.
          </div>
        </div>
      </div>
    </section>
  );
}
