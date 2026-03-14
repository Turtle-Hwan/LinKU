export type ExtensionBridgeMessage =
  | { type: "PING" }
  | { type: "OPEN_WEB_ROUTE"; path: string }
  | { type: "OPEN_SITE_ROUTE"; path: string }
  | { type: "REPORT_CONNECTION"; extensionId?: string; connected: boolean };

export interface ExtensionConnectionState {
  extensionId?: string;
  connected: boolean;
  lastCheckedAt?: string;
}
