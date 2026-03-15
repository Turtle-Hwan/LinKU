import {
  DEFAULT_EXTENSION_URL,
  DEFAULT_SITE_URL,
  LINKU_PRODUCT_NAME,
} from "@linku/config";
import { buildCanonicalUrl } from "./metadata";

export interface FaqJsonLdItem {
  question: string;
  answer: string;
}

export interface OrganizationJsonLdInput {
  siteUrl?: string;
  description: string;
}

export interface SoftwareApplicationJsonLdInput {
  siteUrl?: string;
  extensionUrl?: string;
  description: string;
  softwareHelpPath?: string;
  featureList: string[];
}

export function createOrganizationJsonLd({
  siteUrl = DEFAULT_SITE_URL,
  description,
}: OrganizationJsonLdInput) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: LINKU_PRODUCT_NAME,
    url: siteUrl,
    description,
  };
}

export function createSoftwareApplicationJsonLd({
  siteUrl = DEFAULT_SITE_URL,
  extensionUrl = DEFAULT_EXTENSION_URL,
  description,
  softwareHelpPath = "/guides/install-extension",
  featureList,
}: SoftwareApplicationJsonLdInput) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: LINKU_PRODUCT_NAME,
    applicationCategory: "BrowserApplication",
    operatingSystem: "ChromeOS, Windows, macOS",
    description,
    url: siteUrl,
    downloadUrl: extensionUrl,
    softwareHelp: buildCanonicalUrl(softwareHelpPath, siteUrl),
    featureList,
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
