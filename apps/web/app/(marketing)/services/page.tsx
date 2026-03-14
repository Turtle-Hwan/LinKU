import Link from "next/link";
import { SERVICES } from "@linku/core";
import { createPageMetadata } from "@linku/seo";
import { siteEnv } from "@/lib/site";

export const metadata = createPageMetadata({
  title: "Services",
  description:
    "Browse LinKU service landing pages for Konkuk eCampus, campus portal routes, and academic calendar entry points.",
  path: "/services",
  siteUrl: siteEnv.siteUrl,
});

export default function ServicesPage() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-8 max-w-3xl space-y-4">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Services</p>
        <h1 data-display="true" className="text-6xl tracking-[-0.05em]">
          Public landing pages for the campus services students revisit most.
        </h1>
        <p className="text-lg leading-8 text-[var(--muted)]">
          These pages exist for search, orientation, and fast internal linking before the extension takes over the
          actual quick-entry experience.
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        {SERVICES.map((service) => (
          <Link
            key={service.slug}
            href={service.path}
            className="rounded-[1.5rem] border border-black/8 bg-white/75 p-6 transition hover:-translate-y-0.5"
          >
            <p className="mb-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Service</p>
            <h2 className="mb-3 text-3xl tracking-[-0.04em]">{service.title}</h2>
            <p className="mb-4 text-sm leading-6 text-[var(--muted)]">{service.summary}</p>
            <div className="text-sm text-[var(--ink)]">Audience: {service.audience}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}
