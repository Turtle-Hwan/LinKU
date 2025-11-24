/**
 * Templates API
 * Template CRUD operations
 */

import { get, post, put, del, ENDPOINTS } from './client';
import type {
  ApiResponse,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  Template,
  TemplateListParams,
  TemplateSummary,
  DeleteResponse,
  PostTemplateResponse,
} from '../types/api';

/**
 * Create a new template
 */
export async function createTemplate(
  data: CreateTemplateRequest
): Promise<ApiResponse<Template>> {
  return post<Template>(ENDPOINTS.TEMPLATES.BASE, data);
}

/**
 * Update an existing template
 */
export async function updateTemplate(
  templateId: number,
  data: UpdateTemplateRequest
): Promise<ApiResponse<Template>> {
  return put<Template>(ENDPOINTS.TEMPLATES.DETAIL(templateId), data);
}

/**
 * Delete a template
 */
export async function deleteTemplate(
  templateId: number
): Promise<ApiResponse<DeleteResponse>> {
  return del<DeleteResponse>(ENDPOINTS.TEMPLATES.DETAIL(templateId));
}

/**
 * Get template detail by ID
 */
export async function getTemplate(
  templateId: number
): Promise<ApiResponse<Template>> {
  return get<Template>(ENDPOINTS.TEMPLATES.DETAIL(templateId));
}

/**
 * Get list of templates owned by the user
 */
export async function getOwnedTemplates(
  params?: TemplateListParams
): Promise<ApiResponse<TemplateSummary[]>> {
  return get<TemplateSummary[]>(ENDPOINTS.TEMPLATES.OWNED, { params });
}

/**
 * Get list of templates cloned by the user
 */
export async function getClonedTemplates(
  params?: TemplateListParams
): Promise<ApiResponse<TemplateSummary[]>> {
  return get<TemplateSummary[]>(ENDPOINTS.TEMPLATES.CLONED, { params });
}

/**
 * Publish a template to make it public
 */
export async function postTemplate(
  templateId: number
): Promise<ApiResponse<PostTemplateResponse>> {
  return post<PostTemplateResponse>(ENDPOINTS.TEMPLATES.POST(templateId));
}

/**
 * Sync template to server
 * If local-only template (timestamp-based ID), creates new template on server
 * If existing server template, updates it
 */
export async function syncTemplateToServer(
  template: Template
): Promise<ApiResponse<Template>> {
  // Prepare payload
  const payload: CreateTemplateRequest = {
    templateId: 0, // Server will assign new ID for create
    name: template.name,
    height: template.height,
    items: template.items.map((item) => ({
      name: item.name,
      siteUrl: item.siteUrl,
      id: item.icon.id,
      position: item.position,
      size: item.size,
    })),
  };

  // Check if this is a local-only template (timestamp-based ID)
  // Timestamp IDs are much larger than sequential IDs (> 100000000)
  const isLocalOnly = template.templateId > 100000000;

  if (isLocalOnly) {
    // Create new template on server
    return createTemplate(payload);
  } else {
    // Update existing template on server
    return updateTemplate(template.templateId, {
      name: template.name,
      height: template.height,
      items: payload.items,
    });
  }
}
