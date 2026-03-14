import { createPageMetadata } from "@linku/seo";
import { buildInstallUrl } from "@linku/platform";
import { CtaLink } from "@/components/cta-link";
import { siteEnv } from "@/lib/site";

export const metadata = createPageMetadata({
  title: "Install",
  description:
    "Install the LinKU Chrome extension, pin it to your toolbar, and pair it with the single-domain LinKU web experience.",
  path: "/install",
  siteUrl: siteEnv.siteUrl,
});

const installSteps = [
  "Open the LinKU Chrome Web Store listing.",
  "Add the extension to Chrome and pin it to the toolbar.",
  "Start from the popup card for fast campus-service entry.",
];

const installReasons = [
  "The extension keeps browser-native campus shortcuts one click away.",
  "The web surface stays focused on discovery, guides, FAQ, and account entry.",
  "Single-domain routes such as /login and /dashboard can grow without splitting domains later.",
];

export default function InstallPage() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <div className="rounded-[2rem] border border-black/8 bg-white/70 p-8 shadow-[0_30px_90px_rgba(19,42,34,0.08)]">
        <p className="mb-3 text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Install</p>
        <h1 data-display="true" className="mb-4 text-6xl leading-[0.95] tracking-[-0.05em]">
          Add LinKU to Chrome and keep campus shortcuts close.
        </h1>
        <p className="max-w-3xl text-lg leading-8 text-[var(--muted)]">
          LinKU is extension-first by design. Install once, pin it, and use the web surface for richer guidance,
          route discovery, and account entry on the same canonical domain.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <CtaLink href={buildInstallUrl(siteEnv.extensionUrl)} external>
            Open Chrome Web Store
          </CtaLink>
          <CtaLink href="/login" variant="outline">
            Visit the login route
          </CtaLink>
        </div>
        <ol className="mt-10 grid gap-4 md:grid-cols-3">
          {installSteps.map((step, index) => (
            <li key={step} className="rounded-[1.2rem] border border-black/8 bg-[#f6f0e1] p-5 text-sm leading-6">
              <div className="mb-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Step 0{index + 1}
              </div>
              {step}
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {installReasons.map((item) => (
          <article key={item} className="rounded-[1.5rem] border border-black/8 bg-[var(--surface)] p-6 text-sm leading-7">
            {item}
          </article>
        ))}
      </div>
    </section>
  );
}
