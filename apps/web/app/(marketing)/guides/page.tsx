import Link from "next/link";
import { GUIDES } from "@linku/core";
import { createPageMetadata } from "@linku/seo";
import { siteEnv } from "@/lib/site";

export const metadata = createPageMetadata({
  title: "Guides",
  description:
    "Read LinKU setup and usage guides for extension install, first-run workflow, and future account entry on the same domain.",
  path: "/guides",
  siteUrl: siteEnv.siteUrl,
});

export default function GuidesPage() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <div className="mb-8 max-w-3xl space-y-4">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Guides</p>
        <h1 data-display="true" className="text-6xl tracking-[-0.05em]">
          Install once, then learn the shortest path to repeated campus work.
        </h1>
        <p className="text-lg leading-8 text-[var(--muted)]">
          These authored guides support onboarding and search, while the extension handles the privileged browser
          work the web should not fake.
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {GUIDES.map((guide) => (
          <Link
            key={guide.slug}
            href={guide.path}
            className="rounded-[1.5rem] border border-black/8 bg-white/75 p-6 transition hover:-translate-y-0.5"
          >
            <p className="mb-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Guide</p>
            <h2 className="mb-3 text-3xl tracking-[-0.04em]">{guide.title}</h2>
            <p className="text-sm leading-6 text-[var(--muted)]">{guide.summary}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
