/**
 * Alerts API
 * Notification and subscription management
 */

import { get, post, del, ENDPOINTS } from './client';
import type {
  ApiResponse,
  GeneralAlert,
  AlertFilterParams,
  Department,
  Subscription,
} from '../types/api';
import { getAlertsFromRSS } from './external/rss-parser';
import { getCareerAlertsFromHTML } from './external/html-parser';

/**
 * Get filtered alerts by category
 * Fetch alerts with optional category filter
 * Falls back to external sources (RSS/HTML) for categories that fail via API
 */
export async function getAlerts(
  params?: AlertFilterParams
): Promise<ApiResponse<GeneralAlert[]>> {
  try {
    // If specific category is requested, try API first
    if (params?.category) {
      const result = await get<GeneralAlert[]>(ENDPOINTS.ALERTS.BASE, { params });

      // If API succeeded, return the result
      if (result.success && result.status === 200) {
        return result;
      }

      // If API failed for this category, fallback to external sources
      console.warn(`API failed for category ${params.category}, falling back to external sources`);

      const [rssAlerts, careerAlerts] = await Promise.all([
        getAlertsFromRSS(),
        getCareerAlertsFromHTML(6000),
      ]);

      const allAlerts = [...rssAlerts, ...careerAlerts];
      const filteredAlerts = allAlerts.filter(alert => alert.category === params.category);

      return {
        success: true,
        data: filteredAlerts,
        status: 200,
      };
    }

    // If no category specified, try API first for all categories
    const result = await get<GeneralAlert[]>(ENDPOINTS.ALERTS.BASE);

    // If API succeeded, return the result
    if (result.success && result.status === 200) {
      return result;
    }

    // If API failed, fallback to external sources for all categories
    console.warn("API failed, falling back to external sources");

    const [rssAlerts, careerAlerts] = await Promise.all([
      getAlertsFromRSS(),
      getCareerAlertsFromHTML(6000),
    ]);

    const allAlerts = [...rssAlerts, ...careerAlerts];

    return {
      success: true,
      data: allAlerts,
      status: 200,
    };
  } catch (error) {
    // If API and external sources fail, return error
    console.error("API and external sources failed:", error);
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
export async function getMyAlerts(): Promise<ApiResponse<GeneralAlert[]>> {
  return get<GeneralAlert[]>(ENDPOINTS.ALERTS.MY);
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
