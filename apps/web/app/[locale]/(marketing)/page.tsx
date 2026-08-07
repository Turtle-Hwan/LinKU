import { Button } from "@linku/ui";
import { JsonLd } from "@/components/json-ld";
import { LinkuCardPreview } from "@/components/linku-card-preview";
import { Link } from "@/i18n/navigation";
import { resolveRouteParams } from "@/lib/intl";
import {
  createLocalizedMetadata,
  createLocalizedOrganizationJsonLd,
  createLocalizedSoftwareApplicationJsonLd,
} from "@/lib/seo";
import { siteEnv } from "@/lib/site";

export async function generateMetadata({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);

  return createLocalizedMetadata({
    locale,
    titleKey: "pages.home.meta.title",
    descriptionKey: "pages.home.meta.description",
    path: "/",
  });
}

export default async function HomePage({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);
  const copy =
    locale === "ko"
      ? {
          eyebrow: "건국대 학생을 위한 Chrome 확장 프로그램",
          headline: "익숙한 LinKU를 웹에서도 그대로.",
          body: "링크모음, 공지사항, 시간표, Todo처럼 확장에서 쓰던 흐름을 바꾸지 않고 웹에서도 이어서 사용할 수 있습니다.",
          install: "Chrome에 추가",
          login: "웹에서 로그인",
          guide: "설치 가이드",
        }
      : {
          eyebrow: "Chrome extension for Konkuk students",
          headline: "The LinKU you know, now on the web.",
          body: "Continue using links, notices, timetable, and todos without relearning the interface.",
          install: "Add to Chrome",
          login: "Sign in on the web",
          guide: "Install guide",
        };

  return (
    <>
      <JsonLd data={await createLocalizedOrganizationJsonLd(locale)} />
      <JsonLd data={await createLocalizedSoftwareApplicationJsonLd(locale)} />

      <section className="bg-white">
        <div className="mx-auto grid max-w-5xl items-center gap-16 px-6 pb-16 lg:grid-cols-[minmax(280px,1fr)_500px] lg:gap-12 lg:py-14">
          <div className="flex min-h-[calc(100svh-12rem)] flex-col items-start justify-center gap-6 py-12 lg:min-h-0 lg:gap-4 lg:py-0">
            <p className="text-sm font-medium text-main">{copy.eyebrow}</p>
            <h1
              data-display="true"
              className="max-w-lg text-2xl font-semibold leading-tight tracking-tight sm:text-3xl"
            >
              {copy.headline}
            </h1>
            <p className="max-w-lg text-base leading-7 text-muted-foreground">
              {copy.body}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild className="bg-main text-white hover:bg-hover">
                <a href={siteEnv.extensionUrl} target="_blank" rel="noreferrer">
                  {copy.install}
                </a>
              </Button>
              <Button asChild variant="outline">
                <Link href="/login">{copy.login}</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/guides/install-extension">{copy.guide}</Link>
              </Button>
            </div>
          </div>

          <LinkuCardPreview locale={locale} />
        </div>
      </section>
    </>
  );
}
