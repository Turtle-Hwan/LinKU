import type { PortableTemplateItem, TemplateSharePayloadV1 } from "@/types/templateShare";

export type ApiErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "CONFLICT"
  | "INVALID_REQUEST"
  | "PAYLOAD_TOO_LARGE"
  | "SHARE_NOT_FOUND"
  | "RATE_LIMITED"
  | "UPSTREAM_UNAVAILABLE";

export type ApiResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: ApiErrorCode;
        message: string;
        retryable: boolean;
        requestId: string;
      };
    };

export interface AuthProfile {
  name: string;
  email: string;
  picture: string;
}

export interface AuthSessionResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  accountId: string;
  profile: AuthProfile;
}

export interface SyncedTemplateDocumentV1 {
  version: 1;
  id: string;
  name: string;
  height: number;
  cloned: boolean;
  items: PortableTemplateItem[];
  stagingItems: PortableTemplateItem[];
  createdAt: string;
  updatedAt: string;
}

export interface SyncIndexEntry {
  id: string;
  etag: string;
  size: number;
  uploadedAt: string;
  deleted?: boolean;
}

export interface SyncIndexResponse {
  templates: SyncIndexEntry[];
}

export interface CloudShareRecord {
  version: 1;
  createdAt: string;
  expiresAt: string;
  ownerId: string;
  payload: TemplateSharePayloadV1;
}
