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
 * Backend response type for my alerts API
 */
interface MyAlertsResponse {
  alertResponseList: Array<{
    alertId: number;
    departmentName: string;
    url: string;
    title: string;
    postTime: string;
    content: string;
  }>;
}

/**
 * Get my alerts
 * Fetch alerts from subscribed departments
 */
export async function getMyAlerts(): Promise<ApiResponse<GeneralAlert[]>> {
  const response = await get<MyAlertsResponse>(ENDPOINTS.ALERTS.MY);

  if (response.success && response.data?.alertResponseList) {
    // Transform to GeneralAlert format
    const alerts: GeneralAlert[] = response.data.alertResponseList.map(item => ({
      alertId: item.alertId,
      title: item.title,
      content: item.content,
      category: item.departmentName as GeneralAlert['category'],
      url: item.url,
      publishedAt: item.postTime,
    }));
    return { ...response, data: alerts };
  }

  return { ...response, data: [] };
}

/**
 * Backend response type for subscription API
 */
interface DepartmentConfigResponse {
  departmentConfigList: Array<{
    departmentConfigId: number;
    departmentConfigName: string;
  }>;
}

/**
 * Get all available departments for subscription
 * Transforms backend response to frontend Department format
 */
export async function getSubscriptions(): Promise<ApiResponse<Department[]>> {
  const response = await get<DepartmentConfigResponse>(ENDPOINTS.ALERTS.SUBSCRIPTION);

  if (response.success && response.data?.departmentConfigList) {
    // Transform field names to match frontend Department type
    // Use type assertion since API may return categories not in DepartmentCategory
    const departments = response.data.departmentConfigList.map(item => ({
      id: item.departmentConfigId,
      name: item.departmentConfigName,
    })) as Department[];
    return { ...response, data: departments };
  }

  return { ...response, data: [] };
}

/**
 * Get my subscribed departments
 * Uses same response structure as getSubscriptions (departmentConfigList)
 */
export async function getMySubscriptions(): Promise<ApiResponse<Subscription[]>> {
  const response = await get<DepartmentConfigResponse>(ENDPOINTS.ALERTS.MY_SUBSCRIPTION);

  if (response.success && response.data?.departmentConfigList) {
    // Transform to Subscription format (using departmentConfigId as subscriptionId)
    const subscriptions: Subscription[] = response.data.departmentConfigList.map(item => ({
      subscriptionId: item.departmentConfigId,
      department: {
        id: item.departmentConfigId,
        name: item.departmentConfigName,
      } as Department,
      createdAt: '',
    }));
    return { ...response, data: subscriptions };
  }

  return { ...response, data: [] };
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
