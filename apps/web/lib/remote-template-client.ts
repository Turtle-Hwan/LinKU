"use client";

import type {
  CloneTemplateResponse,
  LikeTemplateResponse,
  PostedTemplate,
  PostedTemplateListParams,
  PostedTemplateSummary,
  PostTemplateResponse,
  Template,
  TemplateListParams,
  TemplateSummary,
} from "@linku/shared-types";

export class RemoteTemplateError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "RemoteTemplateError";
    this.status = status;
  }
}

function buildQueryString(params?: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();

  if (!params) {
    return "";
  }

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      searchParams.set(key, String(value));
    }
  });

  const serialized = searchParams.toString();
  return serialized.length > 0 ? `?${serialized}` : "";
}

async function requestJson<TPayload>(input: string, init?: RequestInit) {
  const response = await fetch(input, {
    ...init,
    headers: {
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | TPayload
    | { message?: string }
    | null;

  if (!response.ok) {
    throw new RemoteTemplateError(
      typeof payload === "object" &&
        payload !== null &&
        "message" in payload &&
        typeof payload.message === "string"
        ? payload.message
        : `Template request failed (${response.status}).`,
      response.status,
    );
  }

  return payload as TPayload;
}

export function getOwnedRemoteTemplates(params?: TemplateListParams) {
  return requestJson<TemplateSummary[]>(
    `/api/templates/owned${buildQueryString(params as Record<string, string | number | undefined>)}`,
  );
}

export function getClonedRemoteTemplates(params?: TemplateListParams) {
  return requestJson<TemplateSummary[]>(
    `/api/templates/cloned${buildQueryString(params as Record<string, string | number | undefined>)}`,
  );
}

export function getRemoteTemplate(templateId: number) {
  return requestJson<Template>(`/api/templates/${templateId}`);
}

export function createRemoteTemplate(payload: {
  templateId: number;
  name: string;
  height: number;
  items: Array<{
    name: string;
    siteUrl: string;
    iconId: number;
    position: { x: number; y: number };
    size: { width: number; height: number };
  }>;
}) {
  return requestJson<Template>("/api/templates", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function updateRemoteTemplate(
  templateId: number,
  payload: {
    name?: string;
    height?: number;
    items?: Array<{
      name: string;
      siteUrl: string;
      iconId: number;
      position: { x: number; y: number };
      size: { width: number; height: number };
    }>;
  },
) {
  return requestJson<Template>(`/api/templates/${templateId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function deleteRemoteTemplate(templateId: number) {
  return requestJson<{ message: string }>(`/api/templates/${templateId}`, {
    method: "DELETE",
  });
}

export function publishRemoteTemplate(templateId: number) {
  return requestJson<PostTemplateResponse>(`/api/templates/${templateId}/post`, {
    method: "POST",
  });
}

export function getPublicPostedTemplates(params?: PostedTemplateListParams) {
  return requestJson<PostedTemplateSummary[]>(
    `/api/posted-templates/public${buildQueryString(params as Record<
      string,
      string | number | undefined
    >)}`,
  );
}

export function getMyPostedTemplates(params?: PostedTemplateListParams) {
  return requestJson<PostedTemplateSummary[]>(
    `/api/posted-templates/my${buildQueryString(params as Record<
      string,
      string | number | undefined
    >)}`,
  );
}

export function getPostedTemplateDetail(postedTemplateId: number) {
  return requestJson<PostedTemplate>(`/api/posted-templates/${postedTemplateId}`);
}

export function clonePostedTemplate(postedTemplateId: number) {
  return requestJson<CloneTemplateResponse>(
    `/api/posted-templates/${postedTemplateId}/clone`,
    {
      method: "POST",
    },
  );
}

export function toggleLikePostedTemplate(postedTemplateId: number) {
  return requestJson<LikeTemplateResponse>(
    `/api/posted-templates/${postedTemplateId}/like`,
    {
      method: "POST",
    },
  );
}

export function deletePostedTemplate(postedTemplateId: number) {
  return requestJson<{ message: string }>(`/api/posted-templates/${postedTemplateId}`, {
    method: "DELETE",
  });
}
