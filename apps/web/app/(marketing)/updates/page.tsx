import { createPageMetadata } from "@linku/seo";
import { siteEnv, updateEntries } from "@/lib/site";

export const metadata = createPageMetadata({
  title: "Updates",
  description:
    "Follow LinKU changes across the monorepo foundation, shared packages, and single-domain web direction.",
  path: "/updates",
  siteUrl: siteEnv.siteUrl,
});

export default function UpdatesPage() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-16">
      <div className="mb-8 max-w-3xl space-y-4">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Updates</p>
        <h1 data-display="true" className="text-6xl tracking-[-0.05em]">
          Product direction, implementation milestones, and structural changes.
        </h1>
        <p className="text-lg leading-8 text-[var(--muted)]">
          This log tracks the monorepo, the shared package layer, and the move to a single canonical web domain.
        </p>
      </div>
      <div className="grid gap-4">
        {updateEntries.map((entry) => (
          <article key={entry.slug} className="rounded-[1.5rem] border border-black/8 bg-white/75 p-6">
            <p className="mb-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{entry.publishedAt}</p>
            <h2 className="mb-3 text-3xl tracking-[-0.04em]">{entry.title}</h2>
            <p className="mb-5 text-sm leading-7 text-[var(--muted)]">{entry.summary}</p>
            <ul className="space-y-2 text-sm leading-7">
              {entry.bullets.map((bullet) => (
                <li key={bullet}>- {bullet}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
