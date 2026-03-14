import Link from "next/link";
import { notFound } from "next/navigation";
import { SERVICES } from "@linku/core";
import { createPageMetadata } from "@linku/seo";
import { siteEnv } from "@/lib/site";

export function generateStaticParams() {
  return SERVICES.map((service) => ({ slug: service.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = SERVICES.find((item) => item.slug === slug);

  if (!service) {
    return createPageMetadata({
      title: "Service not found",
      description: "The requested service page does not exist.",
      path: `/services/${slug}`,
      siteUrl: siteEnv.siteUrl,
    });
  }

  return createPageMetadata({
    title: service.title,
    description: service.summary,
    path: service.path,
    siteUrl: siteEnv.siteUrl,
  });
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = SERVICES.find((item) => item.slug === slug);

  if (!service) {
    notFound();
  }

  const currentService = service;

  return (
    <section className="mx-auto max-w-4xl px-6 py-16">
      <p className="mb-3 text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Service</p>
      <h1 data-display="true" className="mb-5 text-6xl leading-[0.95] tracking-[-0.05em]">
        {currentService.title}
      </h1>
      <p className="mb-8 text-lg leading-8 text-[var(--muted)]">{currentService.summary}</p>
      <div className="rounded-[1.5rem] border border-black/8 bg-white/75 p-6">
        <p className="mb-4 text-sm uppercase tracking-[0.2em] text-[var(--muted)]">Common tasks</p>
        <ul className="space-y-3 text-sm leading-7">
          {currentService.tasks.map((task) => (
            <li key={task}>- {task}</li>
          ))}
        </ul>
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/install" className="rounded-full border border-black/10 px-5 py-3">
          Install extension
        </Link>
        <Link href="/features/ecampus" className="rounded-full border border-black/10 px-5 py-3">
          See feature context
        </Link>
      </div>
    </section>
  );
}
