export type AccountSyncStatus = "error" | "local" | "pending" | "synced";

export interface AccountProfile {
  userId: string;
  nickname: string;
}

export interface CloudBuiltinIcon {
  kind: "builtin";
  key: string;
}

export interface CloudAssetIcon {
  kind: "asset";
  hash: string;
  name: string;
}

export type CloudTemplateIcon = CloudBuiltinIcon | CloudAssetIcon;

export interface CloudTemplateItem {
  templateItemId: number;
  name: string;
  siteUrl: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  icon: CloudTemplateIcon;
}

export interface CloudTemplateDocumentV1 {
  version: 1;
  name: string;
  height: number;
  cloned: boolean;
  createdAt: string;
  updatedAt: string;
  items: CloudTemplateItem[];
  stagingItems: CloudTemplateItem[];
}

export interface PublishedTemplateSnapshotV1 {
  version: 1;
  name: string;
  height: number;
  items: CloudTemplateItem[];
}

export interface RemoteTemplate {
  id: string;
  document: CloudTemplateDocumentV1;
  contentHash: string;
  revision: number;
  deletedAt: string | null;
  updatedAt: string;
}

export interface TemplatePublication {
  templateId: string;
  snapshot: PublishedTemplateSnapshotV1;
  revision: number;
  sourceContentHash?: string;
  authorNickname: string;
  likeCount: number;
  cloneCount: number;
  publishedAt: string;
  updatedAt: string;
  unpublishedAt?: string | null;
  isLiked?: boolean;
}

export type PublicationSort = "clones" | "latest" | "likes";
