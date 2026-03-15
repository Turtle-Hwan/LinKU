import { DEFAULT_SITE_URL, LINKU_PRODUCT_NAME } from "@linku/config";

export interface LinkuMetadataInput {
  title: string;
  description: string;
  path?: string;
  siteUrl?: string;
  imagePath?: string;
  index?: boolean;
  languages?: Record<string, string>;
}

export function buildCanonicalUrl(
  path = "/",
  siteUrl = DEFAULT_SITE_URL,
): string {
  return new URL(path, siteUrl.endsWith("/") ? siteUrl : `${siteUrl}/`).toString();
}

export function createPageMetadata({
  title,
  description,
  path = "/",
  siteUrl = DEFAULT_SITE_URL,
  imagePath = "/opengraph-image",
  index = true,
  languages,
}: LinkuMetadataInput) {
  const canonical = buildCanonicalUrl(path, siteUrl);
  const imageUrl = buildCanonicalUrl(imagePath, siteUrl);
  const alternates =
    languages &&
    Object.fromEntries(
      Object.entries(languages).map(([locale, localePath]) => [
        locale,
        buildCanonicalUrl(localePath, siteUrl),
      ]),
    );

  return {
    metadataBase: new URL(siteUrl),
    title,
    description,
    alternates: {
      canonical,
      languages: alternates,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
      siteName: LINKU_PRODUCT_NAME,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
    robots: index
      ? undefined
      : {
          index: false,
          follow: false,
          nocache: true,
          googleBot: {
            index: false,
            follow: false,
          },
        },
  };
}
