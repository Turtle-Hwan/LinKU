import Link from "next/link";
import { FEATURES, GUIDES, SERVICES } from "@linku/core";
import {
  createOrganizationJsonLd,
  createPageMetadata,
  createSoftwareApplicationJsonLd,
} from "@linku/seo";
import { buildInstallUrl } from "@linku/platform";
import { CtaLink } from "@/components/cta-link";
import { JsonLd } from "@/components/json-ld";
import { LinkuCardPreview } from "@/components/linku-card-preview";
import { siteEnv, updateEntries } from "@/lib/site";

export const metadata = createPageMetadata({
  title: "LinKU",
  description:
    "Discover LinKU, a Chrome-extension-first companion for Konkuk University with install guides, feature pages, service landing pages, and path-based account routes.",
  path: "/",
  siteUrl: siteEnv.siteUrl,
});

const quickStats = [
  { label: "Canonical domain", value: "www.linku.xxx" },
  { label: "Install flow", value: "Chrome Web Store" },
  { label: "Auth entry", value: "/login" },
];

export default function HomePage() {
  return (
    <>
      <JsonLd data={createOrganizationJsonLd(siteEnv.siteUrl)} />
      <JsonLd data={createSoftwareApplicationJsonLd(siteEnv.siteUrl, siteEnv.extensionUrl)} />

      <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl gap-10 px-6 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="space-y-8">
          <div className="inline-flex rounded-full border border-black/10 bg-white/70 px-4 py-2 text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
            Single-domain public web + extension-first workflow
          </div>
          <div className="space-y-5">
            <p data-display="true" className="max-w-3xl text-6xl leading-[0.92] tracking-[-0.05em] text-[var(--ink)] md:text-8xl">
              Faster campus paths, without rebuilding your whole routine.
            </p>
            <p className="max-w-2xl text-lg leading-8 text-[var(--muted)]">
              LinKU keeps the Chrome extension focused on the browser-native shortcuts students actually use, while
              the web surface handles discovery, install guidance, FAQ, and future account features on the same
              canonical domain.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <CtaLink href={buildInstallUrl(siteEnv.extensionUrl)} external>
              Install the extension
            </CtaLink>
            <CtaLink href="/login" variant="outline">
              Open login route
            </CtaLink>
            <CtaLink href="/guides/install-extension" variant="ghost">
              Read the install guide
            </CtaLink>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {quickStats.map((item) => (
              <article
                key={item.label}
                className="rounded-[1.5rem] border border-black/8 bg-white/75 p-5 shadow-[0_20px_50px_rgba(19,42,34,0.08)]"
              >
                <p className="mb-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{item.label}</p>
                <h2 className="text-2xl leading-tight tracking-[-0.04em]">{item.value}</h2>
              </article>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <LinkuCardPreview />
          <div className="grid gap-4 md:grid-cols-2">
            {GUIDES.map((guide) => (
              <Link
                key={guide.slug}
                href={guide.path}
                className="rounded-[1.4rem] border border-black/8 bg-[#132a22] p-5 text-white transition hover:-translate-y-0.5"
              >
                <p className="mb-2 text-xs uppercase tracking-[0.2em] text-white/60">Guide</p>
                <div className="text-2xl tracking-[-0.04em]">{guide.title}</div>
                <p className="mt-3 text-sm leading-6 text-white/70">{guide.summary}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-14 md:grid-cols-3">
        {FEATURES.map((feature) => (
          <article key={feature.slug} className="rounded-[1.6rem] border border-black/8 bg-[var(--surface)] p-6">
            <p className="mb-3 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Feature</p>
            <h2 className="mb-3 text-3xl tracking-[-0.04em]">{feature.title}</h2>
            <p className="mb-5 text-sm leading-6 text-[var(--muted)]">{feature.summary}</p>
            <Link href={feature.path} className="text-sm font-medium underline underline-offset-4">
              Read feature detail
            </Link>
          </article>
        ))}
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-14 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[2rem] border border-black/8 bg-white/70 p-8 shadow-[0_30px_90px_rgba(19,42,34,0.08)]">
          <p className="mb-3 text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Campus services</p>
          <h2 data-display="true" className="mb-5 text-5xl leading-[0.96] tracking-[-0.05em]">
            Search-friendly landing pages for the routes students actually reopen.
          </h2>
          <div className="grid gap-4">
            {SERVICES.map((service) => (
              <Link
                key={service.slug}
                href={service.path}
                className="rounded-[1.3rem] border border-black/8 bg-[#f6f0e1] p-5 transition hover:border-black/20"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="text-2xl tracking-[-0.04em]">{service.title}</h3>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">{service.summary}</p>
                  </div>
                  <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Service</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-black/8 bg-[#132a22] p-8 text-white">
          <p className="mb-3 text-xs uppercase tracking-[0.24em] text-white/60">Latest update</p>
          <h2 data-display="true" className="mb-5 text-5xl leading-[0.96] tracking-[-0.05em]">
            {updateEntries[0]?.title}
          </h2>
          <p className="text-sm leading-7 text-white/75">{updateEntries[0]?.summary}</p>
          <ul className="mt-6 space-y-3 text-sm leading-7 text-white/85">
            {updateEntries[0]?.bullets.map((bullet) => (
              <li key={bullet}>- {bullet}</li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <CtaLink href="/updates" variant="secondary">
              Read updates
            </CtaLink>
            <CtaLink href="/faq" variant="outline">
              See FAQ
            </CtaLink>
          </div>
        </div>
      </section>
    </>
  );
}
