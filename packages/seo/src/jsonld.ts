import {
  DEFAULT_EXTENSION_URL,
  DEFAULT_SITE_URL,
  LINKU_PRODUCT_NAME,
  LINKU_TAGLINE,
} from "@linku/config";
import { buildCanonicalUrl } from "./metadata";

export interface FaqJsonLdItem {
  question: string;
  answer: string;
}

export function createOrganizationJsonLd(siteUrl = DEFAULT_SITE_URL) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: LINKU_PRODUCT_NAME,
    url: siteUrl,
    description: LINKU_TAGLINE,
  };
}

export function createSoftwareApplicationJsonLd(
  siteUrl = DEFAULT_SITE_URL,
  extensionUrl = DEFAULT_EXTENSION_URL,
) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: LINKU_PRODUCT_NAME,
    applicationCategory: "BrowserApplication",
    operatingSystem: "ChromeOS, Windows, macOS",
    description: LINKU_TAGLINE,
    url: siteUrl,
    downloadUrl: extensionUrl,
    softwareHelp: buildCanonicalUrl("/guides/install-extension", siteUrl),
    featureList: [
      "Quick access to Konkuk University services",
      "Konkuk eCampus launch shortcuts",
      "Personal dashboard links and favorites",
    ],
    publisher: {
      "@type": "Organization",
      name: LINKU_PRODUCT_NAME,
      url: siteUrl,
    },
  };
}

export function createFaqJsonLd(items: FaqJsonLdItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}
