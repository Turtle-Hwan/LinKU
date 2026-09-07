/**
 * Alerts API
 * Direct public notice cache
 */

import type {
  ApiResponse,
  GeneralAlert,
  AlertFilterParams,
} from '../types/api';
import {
  getCachedPublicAlerts,
  syncPublicAlerts,
  type PublicAlertSyncFailure,
} from './public-alert-cache';
import { captureErrorLog } from '@/utils/logger';

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
  captureErrorLog("[Alerts] Public alert sync contract failed", error, {
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
    captureErrorLog("[Alerts] Failed to synchronize public alerts", error);
    return failedAlertsResponse();
  }
}
