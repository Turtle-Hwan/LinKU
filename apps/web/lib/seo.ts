import { getTranslations } from "next-intl/server";
import {
  createOrganizationJsonLd,
  createPageMetadata,
  createSoftwareApplicationJsonLd,
  type OrganizationJsonLdInput,
  type SoftwareApplicationJsonLdInput,
} from "@linku/seo";
import { getLocaleAlternates, getLocalizedPathname } from "@/lib/intl";
import { siteEnv } from "@/lib/site";
import type { AppLocale } from "@/i18n/routing";

interface LocalizedMetadataInput {
  locale: AppLocale;
  titleKey: string;
  descriptionKey: string;
  path: string;
  index?: boolean;
}

export async function createLocalizedMetadata({
  locale,
  titleKey,
  descriptionKey,
  path,
  index = true,
}: LocalizedMetadataInput) {
  const t = await getTranslations({ locale });

  return createPageMetadata({
    title: t(titleKey),
    description: t(descriptionKey),
    path: getLocalizedPathname(path, locale),
    imagePath: getLocalizedPathname("/opengraph-image", locale),
    siteUrl: siteEnv.siteUrl,
    index,
    languages: index ? getLocaleAlternates(path) : undefined,
  });
}

export async function createLocalizedOrganizationJsonLd(locale: AppLocale) {
  const t = await getTranslations({ locale });

  return createOrganizationJsonLd({
    siteUrl: siteEnv.siteUrl,
    description: t("layout.meta.description"),
  } satisfies OrganizationJsonLdInput);
}

export async function createLocalizedSoftwareApplicationJsonLd(
  locale: AppLocale,
) {
  const t = await getTranslations({ locale });

  return createSoftwareApplicationJsonLd({
    siteUrl: siteEnv.siteUrl,
    extensionUrl: siteEnv.extensionUrl,
    description: t("layout.meta.description"),
    softwareHelpPath: getLocalizedPathname("/guides/install-extension", locale),
    featureList: [
      t("site.features.todo.title"),
      t("site.features.ecampus.title"),
      t("site.navigation.app.favorites.title"),
    ],
  } satisfies SoftwareApplicationJsonLdInput);
}
