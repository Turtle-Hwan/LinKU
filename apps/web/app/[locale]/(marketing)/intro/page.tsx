import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@linku/ui";
import { DEFAULT_WORKSPACE_TEMPLATE, WORKSPACE_TEMPLATE_PRESETS } from "@linku/platform";
import { PageHeading } from "@/components/page-heading";
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
    <section className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="flex max-w-3xl flex-col items-start gap-4">
        <PageHeading
          eyebrow={copy.intro.eyebrow}
          title={copy.intro.title}
          body={copy.intro.body}
        />
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/dashboard">{copy.intro.ctaDashboard}</Link>
          </Button>
          <Button asChild variant="outline">
            <a href={siteEnv.extensionUrl} target="_blank" rel="noreferrer">
              {copy.intro.ctaInstall}
            </a>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {copy.intro.sections.map((section) => (
          <Card key={section.title} size="sm">
            <CardHeader>
              <CardTitle>{section.title}</CardTitle>
              <CardDescription className="leading-6">{section.body}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <p className="text-sm font-medium text-main">
              {DEFAULT_WORKSPACE_TEMPLATE.title[locale]}
            </p>
            <CardTitle>
              {locale === "ko"
                ? "자주 쓰는 학교 서비스를 한 번에"
                : "Your everyday campus services in one place"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-7 text-muted-foreground">
            {locale === "ko"
              ? `기본 템플릿에는 ${DEFAULT_WORKSPACE_TEMPLATE.shortcutIds.length}개의 학교 바로가기가 포함되어 있습니다.`
              : `The default template includes ${DEFAULT_WORKSPACE_TEMPLATE.shortcutIds.length} campus shortcuts.`}
            </p>
          </CardContent>
          <CardFooter>
            <Button asChild variant="outline">
              <Link href="/dashboard">
                {locale === "ko" ? "대시보드에서 보기" : "View in dashboard"}
              </Link>
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{locale === "ko" ? "갤러리 프리셋" : "Gallery presets"}</CardTitle>
            <CardDescription>
              {locale === "ko"
                ? "필요한 구성으로 빠르게 시작하세요."
                : "Start quickly with a layout that fits your routine."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
            {WORKSPACE_TEMPLATE_PRESETS.slice(1).map((preset) => (
              <div key={preset.id} className="rounded-lg border bg-white p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-medium">{preset.title[locale]}</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {preset.description[locale]}
                    </p>
                  </div>
                  <Button asChild variant="secondary" size="sm">
                    <Link href="/gallery">{locale === "ko" ? "갤러리 열기" : "Open gallery"}</Link>
                  </Button>
                </div>
              </div>
            ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
