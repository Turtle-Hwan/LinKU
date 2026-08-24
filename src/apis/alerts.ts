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
import {
  getCachedPublicAlerts,
  syncPublicAlerts,
  type PublicAlertSyncFailure,
} from './public-alert-cache';
import { errorLog } from '@/utils/logger';

const failedAlertsResponse = (): ApiResponse<GeneralAlert[]> => ({
  success: false,
  error: {
    code: "FETCH_FAILED",
    message: "공지사항을 불러오는데 실패했습니다.",
  },
});

const captureAlertContractFailures = (
  failures: PublicAlertSyncFailure[],
) => {
  const contractFailures = failures.filter(
    ({ kind }) => kind === "sync_contract",
  );
  if (contractFailures.length === 0) {
    return;
  }

  const firstReason = contractFailures[0]?.reason;
  const error = firstReason instanceof Error
    ? firstReason
    : new Error("Public alert sync contract failed");
  errorLog("[Alerts] Public alert sync contract failed", error, {
    failed_sources: contractFailures.map(({ source }) => source),
    failure_count: contractFailures.length,
  });
};

/**
 * Get filtered alerts by category
 * Returns cached alerts immediately without a network request.
 */
export async function getCachedAlerts(
  params?: AlertFilterParams
): Promise<GeneralAlert[]> {
  return getCachedPublicAlerts(params?.category);
}

/**
 * Refreshes stale public alert sources and returns the merged cache.
 * A selected category refreshes only its own source; the all view refreshes
 * only sources whose individual TTL has expired.
 */
export async function getAlerts(
  params?: AlertFilterParams
): Promise<ApiResponse<GeneralAlert[]>> {
  try {
    const { alerts, allFailed, failures } = await syncPublicAlerts(
      params?.category,
    );
    captureAlertContractFailures(failures);

    if (!allFailed || alerts.length > 0) {
      return {
        success: true,
        data: alerts,
        status: 200,
      };
    }

    // External sites being offline, blocked, or returning an HTTP error is an
    // expected degraded state. The source layer already left a breadcrumb;
    // return the fallback result without opening another Sentry issue.
    return failedAlertsResponse();
  } catch (error) {
    // Cache/storage orchestration failures bypass the per-source allSettled
    // result, so this boundary is their single capture owner.
    errorLog("[Alerts] Failed to synchronize public alerts", error);
    return failedAlertsResponse();
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
