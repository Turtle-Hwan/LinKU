import Link from "next/link";
import { notFound } from "next/navigation";
import { FEATURES } from "@linku/core";
import { createPageMetadata } from "@linku/seo";
import { siteEnv } from "@/lib/site";

export function generateStaticParams() {
  return FEATURES.map((feature) => ({ slug: feature.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const feature = FEATURES.find((item) => item.slug === slug);

  if (!feature) {
    return createPageMetadata({
      title: "Feature not found",
      description: "The requested feature page does not exist.",
      path: `/features/${slug}`,
      siteUrl: siteEnv.siteUrl,
    });
  }

  return createPageMetadata({
    title: feature.title,
    description: feature.summary,
    path: feature.path,
    siteUrl: siteEnv.siteUrl,
  });
}

export default async function FeatureDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const feature = FEATURES.find((item) => item.slug === slug);

  if (!feature) {
    notFound();
  }

  const currentFeature = feature;

  return (
    <section className="mx-auto max-w-4xl px-6 py-16">
      <p className="mb-3 text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Feature</p>
      <h1 data-display="true" className="mb-5 text-6xl leading-[0.95] tracking-[-0.05em]">
        {currentFeature.title}
      </h1>
      <p className="mb-8 text-lg leading-8 text-[var(--muted)]">{currentFeature.summary}</p>
      <div className="grid gap-4">
        {currentFeature.highlights.map((highlight) => (
          <article key={highlight} className="rounded-[1.4rem] border border-black/8 bg-white/70 p-6 text-sm leading-7">
            {highlight}
          </article>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/install" className="rounded-full border border-black/10 px-5 py-3">
          Install LinKU
        </Link>
        <Link href="/guides/how-to-use-linku" className="rounded-full border border-black/10 px-5 py-3">
          Read usage guide
        </Link>
      </div>
    </section>
  );
}
