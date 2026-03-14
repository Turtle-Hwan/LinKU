import Link from "next/link";
import { notFound } from "next/navigation";
import { GUIDES } from "@linku/core";
import { createPageMetadata } from "@linku/seo";
import { siteEnv } from "@/lib/site";

export function generateStaticParams() {
  return GUIDES.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = GUIDES.find((item) => item.slug === slug);

  if (!guide) {
    return createPageMetadata({
      title: "Guide not found",
      description: "The requested guide page does not exist.",
      path: `/guides/${slug}`,
      siteUrl: siteEnv.siteUrl,
    });
  }

  return createPageMetadata({
    title: guide.title,
    description: guide.summary,
    path: guide.path,
    siteUrl: siteEnv.siteUrl,
  });
}

export default async function GuideDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = GUIDES.find((item) => item.slug === slug);

  if (!guide) {
    notFound();
  }

  const currentGuide = guide;

  return (
    <section className="mx-auto max-w-4xl px-6 py-16">
      <p className="mb-3 text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Guide</p>
      <h1 data-display="true" className="mb-5 text-6xl leading-[0.95] tracking-[-0.05em]">
        {currentGuide.title}
      </h1>
      <p className="mb-8 text-lg leading-8 text-[var(--muted)]">{currentGuide.summary}</p>
      <ol className="grid gap-4">
        {currentGuide.steps.map((step, index) => (
          <li key={step} className="rounded-[1.4rem] border border-black/8 bg-white/75 p-6 text-sm leading-7">
            <div className="mb-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Step 0{index + 1}</div>
            {step}
          </li>
        ))}
      </ol>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/install" className="rounded-full border border-black/10 px-5 py-3">
          Install LinKU
        </Link>
        <Link href="/login" className="rounded-full border border-black/10 px-5 py-3">
          Visit login
        </Link>
      </div>
    </section>
  );
}
