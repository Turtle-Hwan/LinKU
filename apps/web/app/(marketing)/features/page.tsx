import Link from "next/link";
import { FEATURES } from "@linku/core";
import { createPageMetadata } from "@linku/seo";
import { siteEnv } from "@/lib/site";

export const metadata = createPageMetadata({
  title: "Features",
  description:
    "Explore LinKU features for todo tracking, eCampus launch shortcuts, and campus bookmarks built around repeat student workflows.",
  path: "/features",
  siteUrl: siteEnv.siteUrl,
});

export default function FeaturesPage() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-8 max-w-3xl space-y-4">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Features</p>
        <h1 data-display="true" className="text-6xl tracking-[-0.05em]">
          The extension keeps the quick actions. The web explains why they matter.
        </h1>
        <p className="text-lg leading-8 text-[var(--muted)]">
          Each feature page supports discovery, search intent, and onboarding, while the extension keeps the real
          fast path inside the browser.
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        {FEATURES.map((feature) => (
          <Link
            key={feature.slug}
            href={feature.path}
            className="rounded-[1.5rem] border border-black/8 bg-white/75 p-6 transition hover:-translate-y-0.5"
          >
            <p className="mb-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Feature</p>
            <h2 className="mb-3 text-3xl tracking-[-0.04em]">{feature.title}</h2>
            <p className="mb-4 text-sm leading-6 text-[var(--muted)]">{feature.summary}</p>
            <span className="text-sm font-medium underline underline-offset-4">Open detail</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
