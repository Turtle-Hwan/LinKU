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
import { getAlertsFromRSS } from './external/rss-parser';

/**
 * Get filtered alerts by category
 * Fetch alerts with optional category filter
 * Falls back to RSS feed if API fails
 */
export async function getAlerts(
  params?: AlertFilterParams
): Promise<ApiResponse<Alert[]>> {
  try {
    const result = await get<Alert[]>(ENDPOINTS.ALERTS.BASE, { params });

    // If API call succeeded, return the result
    if (result.success && result.status === 200) {
      return result;
    }

    // If API failed, fallback to RSS
    console.warn("API failed, falling back to RSS feed");
    const rssAlerts = await getAlertsFromRSS();

    // Filter by category if specified
    const filteredAlerts = params?.category
      ? rssAlerts.filter(alert => alert.category === params.category)
      : rssAlerts;

    return {
      success: true,
      data: filteredAlerts,
      status: 200,
    };
  } catch (error) {
    // If both API and RSS fail, return error
    console.error("Both API and RSS failed:", error);
    return {
      success: false,
      error: {
        code: "FETCH_FAILED",
        message: "공지사항을 불러오는데 실패했습니다.",
      },
    };
  }
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
