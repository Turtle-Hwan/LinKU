import Image from "next/image";
import {
  Badge,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@linku/ui";
import { getTranslations } from "next-intl/server";
import { PageHeading } from "@/components/page-heading";
import { Link } from "@/i18n/navigation";
import { resolveRouteParams } from "@/lib/intl";
import { createLocalizedMetadata } from "@/lib/seo";
import { siteEnv } from "@/lib/site";

export async function generateMetadata({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);
  return createLocalizedMetadata({
    locale,
    titleKey: "pages.install.meta.title",
    descriptionKey: "pages.install.meta.description",
    path: "/install",
  });
}

export default async function InstallPage({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);
  const t = await getTranslations({ locale });
  const installSteps = [
    t("site.guides.installExtension.step1"),
    t("site.guides.installExtension.step2"),
    t("site.guides.installExtension.step3"),
  ];
  const installReasons = [
    t("pages.install.reason1"),
    t("pages.install.reason2"),
    t("pages.install.reason3"),
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10 sm:px-6">
      <section className="grid items-center gap-6 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col items-start gap-4">
          <PageHeading
            eyebrow={t("pages.install.eyebrow")}
            title={t("pages.install.headline")}
            body={t("pages.install.body")}
          />
          <div className="flex flex-wrap gap-3">
            <Button asChild className="bg-main text-white hover:bg-hover">
              <a href={siteEnv.extensionUrl} target="_blank" rel="noreferrer">
                {t("pages.install.ctaStore")}
              </a>
            </Button>
            <Button asChild variant="outline">
              <Link href="/guides/install-extension">
                {locale === "ko" ? "설치 가이드" : "Install guide"}
              </Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <Image src="/brand/linku-logo.svg" alt="LinKU" width={112} height={36} />
            <CardTitle>{locale === "ko" ? "Chrome에 LinKU 추가" : "Add LinKU to Chrome"}</CardTitle>
            <CardDescription>
              {locale === "ko" ? "건국대학교 학생용 Chrome 확장 프로그램" : "Chrome extension for Konkuk students"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">
              {locale === "ko" ? "Chrome 웹 스토어" : "Chrome Web Store"}
            </Badge>
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full bg-main text-white hover:bg-hover">
              <a href={siteEnv.extensionUrl} target="_blank" rel="noreferrer">
                {t("pages.install.ctaStore")}
              </a>
            </Button>
          </CardFooter>
        </Card>
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.7fr_1.3fr]">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold">{locale === "ko" ? "설치 순서" : "How to install"}</h2>
          <p className="text-muted-foreground">
            {locale === "ko" ? "세 단계면 준비가 끝납니다." : "You are ready in three steps."}
          </p>
        </div>
        <div className="grid gap-3">
          {installSteps.map((step, index) => (
            <Card key={step} size="sm">
              <CardHeader>
                <CardAction>
                  <Badge variant="outline">0{index + 1}</Badge>
                </CardAction>
                <CardTitle className="leading-6">{step}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {installReasons.map((reason) => (
          <Card key={reason}>
            <CardHeader>
              <CardTitle className="leading-6">{reason}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </section>
    </div>
  );
}
