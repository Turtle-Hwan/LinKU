import { DEFAULT_SITE_URL, LINKU_PRODUCT_NAME } from "@linku/config";

export interface LinkuMetadataInput {
  title: string;
  description: string;
  path?: string;
  siteUrl?: string;
  imagePath?: string;
  index?: boolean;
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
}: LinkuMetadataInput) {
  const canonical = buildCanonicalUrl(path, siteUrl);
  const imageUrl = buildCanonicalUrl(imagePath, siteUrl);

  return {
    title,
    description,
    alternates: {
      canonical,
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
