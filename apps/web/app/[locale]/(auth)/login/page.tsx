import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth, authRuntime, signIn } from "@/auth";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@linku/ui";
import { Link } from "@/i18n/navigation";
import { getLocalizedPathname, resolveRouteParams } from "@/lib/intl";
import { createLocalizedMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);
  return createLocalizedMetadata({
    locale,
    titleKey: "pages.login.meta.title",
    descriptionKey: "pages.login.meta.description",
    path: "/login",
    index: false,
  });
}

export default async function LoginPage({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { locale } = await resolveRouteParams(params);
  const t = await getTranslations({ locale });
  const session = await auth();
  if (session) redirect({ href: "/dashboard", locale });

  async function signInWithGoogle() {
    "use server";
    await signIn("google", {
      redirectTo: getLocalizedPathname("/dashboard", locale),
    });
  }

  const benefits =
    locale === "ko"
      ? ["내 링크와 즐겨찾기 저장", "템플릿과 설정 이어 쓰기", "확장 프로그램 연결 상태 확인"]
      : ["Save your links and favorites", "Keep templates and settings in sync", "Review extension connection"];

  return (
    <section className="mx-auto flex min-h-[calc(100vh-68px)] max-w-xl items-center px-4 py-10 sm:px-6">
      <Card className="w-full">
        <CardHeader>
          <p className="text-sm font-medium text-main">{t("pages.login.eyebrow")}</p>
          <CardTitle className="text-xl">{t("pages.login.headline")}</CardTitle>
          <CardDescription className="leading-6">{t("pages.login.body")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <ul className="grid gap-2 text-sm">
            {benefits.map((benefit) => (
              <li key={benefit} className="rounded-lg border px-3 py-2.5">
                {benefit}
              </li>
            ))}
          </ul>
          <form action={signInWithGoogle}>
            <Button
              type="submit"
              disabled={!authRuntime.googleConfigured}
              className="w-full"
            >
              <span className="flex size-7 items-center justify-center rounded-full bg-white text-sm font-semibold text-black">
                G
              </span>
              {authRuntime.googleConfigured
                ? t("pages.login.continue")
                : t("pages.login.configure")}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-3">
          <p className="text-xs leading-5 text-muted-foreground">
            {locale === "ko"
              ? "로그인하면 개인정보 처리방침과 서비스 운영 기준에 동의한 것으로 봅니다."
              : "By continuing, you agree to the privacy and service policies."}
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link href="/">{t("pages.login.ctaHome")}</Link>
          </Button>
        </CardFooter>
      </Card>
    </section>
  );
}
