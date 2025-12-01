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
 * Fetches alerts from RSS/HTML external sources
 */
export async function getAlerts(
  params?: AlertFilterParams
): Promise<ApiResponse<GeneralAlert[]>> {
  try {
    // Fetch from external sources (RSS/HTML parsing)
    const [rssAlerts, careerAlerts] = await Promise.all([
      getAlertsFromRSS(),
      getCareerAlertsFromHTML(6000),
    ]);

    const allAlerts = [...rssAlerts, ...careerAlerts];

    // Filter by category if specified
    if (params?.category) {
      const filteredAlerts = allAlerts.filter(alert => alert.category === params.category);
      return {
        success: true,
        data: filteredAlerts,
        status: 200,
      };
    }

    return {
      success: true,
      data: allAlerts,
      status: 200,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `[Alerts] Failed to fetch alerts from external sources`,
      `\n  Error: ${errorMessage}`
    );
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
