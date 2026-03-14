export type LinkuAnalyticsEvent =
  | "install_cta_clicked"
  | "app_login_started"
  | "extension_connected"
  | "guide_opened"
  | "faq_viewed";

export interface AnalyticsEventPayload {
  event: LinkuAnalyticsEvent;
  source: "extension" | "web" | "app";
  label?: string;
  value?: number;
}
