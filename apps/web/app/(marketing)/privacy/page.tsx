import { createPageMetadata } from "@linku/seo";
import { siteEnv } from "@/lib/site";

export const metadata = createPageMetadata({
  title: "Privacy",
  description:
    "Read the privacy baseline for LinKU public pages, authenticated routes, and extension-adjacent account flows.",
  path: "/privacy",
  siteUrl: siteEnv.siteUrl,
});

export default function PrivacyPage() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-16">
      <div className="mb-8 max-w-3xl space-y-4">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Privacy</p>
        <h1 data-display="true" className="text-6xl tracking-[-0.05em]">
          A practical privacy baseline for a single-domain LinKU deployment.
        </h1>
        <p className="text-lg leading-8 text-[var(--muted)]">
          Public pages, authenticated routes, and extension-adjacent flows have different data needs even when they
          live on the same canonical domain.
        </p>
      </div>
      <div className="space-y-4 rounded-[1.5rem] border border-black/8 bg-white/75 p-6 text-sm leading-7 text-[var(--muted)]">
        <p>Public pages should stay readable without requiring sign-in or client-only rendering.</p>
        <p>Authenticated routes should use server-verifiable sessions, minimal secrets exposure, and noindex rules.</p>
        <p>Extension-specific tokens and privileged browser APIs remain in the Chrome extension instead of the public web surface.</p>
      </div>
    </section>
  );
}
