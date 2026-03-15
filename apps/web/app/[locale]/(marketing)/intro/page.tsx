import { Button } from "@linku/ui";
import { DEFAULT_WORKSPACE_TEMPLATE, WORKSPACE_TEMPLATE_PRESETS } from "@linku/platform";
import { CtaLink } from "@/components/cta-link";
import { Link } from "@/i18n/navigation";
import { resolveRouteParams } from "@/lib/intl";
import { siteEnv } from "@/lib/site";
import { getWorkspaceCopy } from "@/lib/workspace-copy";

export async function generateMetadata({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);
  const copy = getWorkspaceCopy(locale);

  return {
    title: copy.intro.eyebrow,
    description: copy.intro.body,
    alternates: {
      canonical: locale === "ko" ? "/intro" : `/${locale}/intro`,
    },
  };
}

export default async function IntroPage({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);
  const copy = getWorkspaceCopy(locale);

  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="rounded-[2.4rem] border border-black/8 bg-white/80 p-8 shadow-[0_32px_90px_rgba(19,42,34,0.08)] md:p-10">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
          {copy.intro.eyebrow}
        </p>
        <h1 data-display="true" className="mt-4 max-w-4xl text-5xl tracking-[-0.05em] md:text-7xl">
          {copy.intro.title}
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-[var(--muted)]">
          {copy.intro.body}
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <CtaLink href="/dashboard">{copy.intro.ctaDashboard}</CtaLink>
          <CtaLink href={siteEnv.extensionUrl} external variant="outline">
            {copy.intro.ctaInstall}
          </CtaLink>
        </div>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        {copy.intro.sections.map((section) => (
          <article
            key={section.title}
            className="rounded-[1.8rem] border border-black/8 bg-[#f6f0e1] p-6"
          >
            <h2 className="text-3xl tracking-[-0.04em]">{section.title}</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{section.body}</p>
          </article>
        ))}
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-[1.8rem] border border-black/8 bg-[#132a22] p-7 text-white">
          <p className="text-xs uppercase tracking-[0.24em] text-white/60">
            {DEFAULT_WORKSPACE_TEMPLATE.title[locale]}
          </p>
          <h2 className="mt-3 text-3xl tracking-[-0.04em]">
            {DEFAULT_WORKSPACE_TEMPLATE.description[locale]}
          </h2>
          <p className="mt-4 text-sm leading-7 text-white/75">
            {locale === "ko"
              ? `기본 템플릿에는 ${DEFAULT_WORKSPACE_TEMPLATE.shortcutIds.length}개의 학교 바로가기가 포함되어 있고, web 대시보드에서 바로 적용할 수 있습니다.`
              : `The default template ships with ${DEFAULT_WORKSPACE_TEMPLATE.shortcutIds.length} campus shortcuts and can be applied directly from the web dashboard.`}
          </p>
        </article>

        <article className="rounded-[1.8rem] border border-black/8 bg-white/80 p-7">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
            {locale === "ko" ? "갤러리 프리셋" : "Gallery presets"}
          </p>
          <div className="mt-4 space-y-4">
            {WORKSPACE_TEMPLATE_PRESETS.slice(1).map((preset) => (
              <div key={preset.id} className="rounded-[1.2rem] border border-black/8 bg-[#f6f0e1] p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl tracking-[-0.04em]">{preset.title[locale]}</h3>
                    <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                      {preset.description[locale]}
                    </p>
                  </div>
                  <Button asChild variant="secondary" className="rounded-full">
                    <Link href="/gallery">{locale === "ko" ? "갤러리 열기" : "Open gallery"}</Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
