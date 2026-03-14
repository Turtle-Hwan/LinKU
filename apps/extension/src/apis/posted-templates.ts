/**
 * Posted Templates API
 * Public template sharing and discovery
 */

import { get, post, del, ENDPOINTS } from './client';
import type {
  ApiResponse,
  PostedTemplate,
  PostedTemplateSummary,
  PostedTemplateListParams,
  CloneTemplateResponse,
  LikeTemplateResponse,
  DeleteResponse,
} from '../types/api';

/**
 * Get list of all public posted templates
 */
export async function getPublicPostedTemplates(
  params?: PostedTemplateListParams
): Promise<ApiResponse<PostedTemplateSummary[]>> {
  return get<PostedTemplateSummary[]>(ENDPOINTS.POSTED_TEMPLATES.PUBLIC, { params });
}

/**
 * Get list of templates posted by the current user
 */
export async function getMyPostedTemplates(
  params?: PostedTemplateListParams
): Promise<ApiResponse<PostedTemplateSummary[]>> {
  return get<PostedTemplateSummary[]>(ENDPOINTS.POSTED_TEMPLATES.MY, { params });
}

/**
 * Get detailed information about a posted template
 */
export async function getPostedTemplateDetail(
  postedTemplateId: number
): Promise<ApiResponse<PostedTemplate>> {
  return get<PostedTemplate>(ENDPOINTS.POSTED_TEMPLATES.DETAIL(postedTemplateId));
}

/**
 * Clone a posted template to user's own templates
 */
export async function clonePostedTemplate(
  postedTemplateId: number
): Promise<ApiResponse<CloneTemplateResponse>> {
  return post<CloneTemplateResponse>(
    ENDPOINTS.POSTED_TEMPLATES.CLONE(postedTemplateId),
    {}
  );
}

/**
 * Like or unlike a posted template (toggle)
 */
export async function likePostedTemplate(
  postedTemplateId: number
): Promise<ApiResponse<LikeTemplateResponse>> {
  return post<LikeTemplateResponse>(
    ENDPOINTS.POSTED_TEMPLATES.LIKE(postedTemplateId)
  );
}

/**
 * Delete (unpublish) a posted template
 */
export async function deletePostedTemplate(
  postedTemplateId: number
): Promise<ApiResponse<DeleteResponse>> {
  return del<DeleteResponse>(
    ENDPOINTS.POSTED_TEMPLATES.DELETE(postedTemplateId)
  );
}
