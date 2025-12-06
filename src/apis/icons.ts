/**
 * Icons API
 * Icon asset management
 */

import { get, post, put, del, publicRequest, ENDPOINTS } from './client';
import type { ApiResponse, Icon, CreateIconResponse, DeleteResponse } from '../types/api';

/**
 * Upload and create a new icon
 */
export async function createIcon(
  iconName: string,
  iconFile: File | Blob
): Promise<ApiResponse<CreateIconResponse>> {
  const formData = new FormData();
  formData.append('name', iconName);
  formData.append('file', iconFile);

  return post<CreateIconResponse>(ENDPOINTS.ICONS.BASE, formData);
}

/**
 * Get list of default system icons (public endpoint, no auth required)
 */
export async function getDefaultIcons(): Promise<ApiResponse<Icon[]>> {
  return publicRequest<Icon[]>(ENDPOINTS.ICONS.DEFAULT, "GET");
}

/**
 * Get list of user's custom icons
 */
export async function getMyIcons(): Promise<ApiResponse<Icon[]>> {
  return get<Icon[]>(ENDPOINTS.ICONS.MY);
}

/**
 * Rename an existing icon
 */
export async function renameIcon(
  iconId: number,
  newName: string
): Promise<ApiResponse<Icon>> {
  return put<Icon>(ENDPOINTS.ICONS.RENAME(iconId), { name: newName });
}

/**
 * Delete a custom icon
 */
export async function deleteIcon(
  iconId: number
): Promise<ApiResponse<DeleteResponse>> {
  return del<DeleteResponse>(ENDPOINTS.ICONS.DELETE(iconId));
}
