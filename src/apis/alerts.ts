/**
 * Alerts API
 * Notification and subscription management
 */

import { get, post, del, ENDPOINTS } from './client';
import type {
  ApiResponse,
  Alert,
  AlertFilterParams,
  Department,
  Subscription,
} from '../types/api';

/**
 * Get filtered alerts by category
 * Fetch alerts with optional category filter
 */
export async function getAlerts(
  params?: AlertFilterParams
): Promise<ApiResponse<Alert[]>> {
  return get<Alert[]>(ENDPOINTS.ALERTS.BASE, { params });
}

/**
 * Get my alerts
 * Fetch alerts from subscribed departments
 */
export async function getMyAlerts(): Promise<ApiResponse<Alert[]>> {
  return get<Alert[]>(ENDPOINTS.ALERTS.MY);
}

/**
 * Get all available departments for subscription
 */
export async function getSubscriptions(): Promise<ApiResponse<Department[]>> {
  return get<Department[]>(ENDPOINTS.ALERTS.SUBSCRIPTION);
}

/**
 * Get my subscribed departments
 */
export async function getMySubscriptions(): Promise<ApiResponse<Subscription[]>> {
  return get<Subscription[]>(ENDPOINTS.ALERTS.MY_SUBSCRIPTION);
}

/**
 * Subscribe to a department
 * Start receiving alerts from the department
 */
export async function subscribeDepartment(
  departmentId: number
): Promise<ApiResponse<Subscription>> {
  return post<Subscription>(ENDPOINTS.ALERTS.SUBSCRIBE(departmentId));
}

/**
 * Unsubscribe from a department
 * Stop receiving alerts from the department
 */
export async function unsubscribeDepartment(
  departmentId: number
): Promise<ApiResponse<{ message: string }>> {
  return del<{ message: string }>(ENDPOINTS.ALERTS.UNSUBSCRIBE(departmentId));
}
