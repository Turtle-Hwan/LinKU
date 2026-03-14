import type { ExtensionBridgeMessage } from "@linku/shared-types";

export function createPingMessage(): ExtensionBridgeMessage {
  return { type: "PING" };
}

export function createOpenWebRouteMessage(path: string): ExtensionBridgeMessage {
  return { type: "OPEN_WEB_ROUTE", path };
}

export function createOpenAppRouteMessage(path: string): ExtensionBridgeMessage {
  return createOpenWebRouteMessage(path);
}

export function isExtensionBridgeMessage(
  value: unknown,
): value is ExtensionBridgeMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof (value as { type: unknown }).type === "string"
  );
}
