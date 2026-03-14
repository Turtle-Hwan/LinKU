import { createFaqJsonLd, createPageMetadata } from "@linku/seo";
import { JsonLd } from "@/components/json-ld";
import { faqItems, siteEnv } from "@/lib/site";

export const metadata = createPageMetadata({
  title: "FAQ",
  description:
    "Find answers about LinKU install flow, browser support, authenticated routes, and the single-domain canonical setup.",
  path: "/faq",
  siteUrl: siteEnv.siteUrl,
});

export default function FaqPage() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-16">
      <JsonLd data={createFaqJsonLd(faqItems)} />
      <div className="mb-8 max-w-3xl space-y-4">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">FAQ</p>
        <h1 data-display="true" className="text-6xl tracking-[-0.05em]">
          The short answers before you install or sign in.
        </h1>
        <p className="text-lg leading-8 text-[var(--muted)]">
          LinKU now keeps public pages and account entry routes together on the same canonical host, so the basic
          questions should be just as easy to find as the product itself.
        </p>
      </div>
      <div className="grid gap-4">
        {faqItems.map((item) => (
          <article key={item.question} className="rounded-[1.4rem] border border-black/8 bg-white/75 p-6">
            <h2 className="mb-3 text-2xl tracking-[-0.04em]">{item.question}</h2>
            <p className="text-sm leading-7 text-[var(--muted)]">{item.answer}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
