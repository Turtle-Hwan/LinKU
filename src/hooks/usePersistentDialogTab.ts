import { useCallback, useEffect, useRef, useState } from "react";

import {
  sendNavigationTabView,
  type NavigationTabFeatureArea,
  type NavigationTabViewSource,
} from "@/utils/analytics";
import { getStorage, setStorage } from "@/utils/chrome";
import { captureErrorLog } from "@/utils/logger";

interface UsePersistentDialogTabOptions<T extends string> {
  open: boolean;
  storageKey: string;
  values: readonly T[];
  defaultValue: T;
  featureArea: NavigationTabFeatureArea;
}

function includesValue<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return typeof value === "string" && values.includes(value as T);
}

/**
 * 다이얼로그 탭의 복원·저장과 실제 노출 측정을 한곳에서 관리합니다.
 * 저장 실패는 탭 사용을 막지 않으며 다음 실행에서 기본값으로 복구됩니다.
 */
export function usePersistentDialogTab<T extends string>({
  open,
  storageKey,
  values,
  defaultValue,
  featureArea,
}: UsePersistentDialogTabOptions<T>) {
  const [value, setValue] = useState<T>(defaultValue);
  const [isHydrated, setIsHydrated] = useState(false);
  const initialViewSourceRef = useRef<NavigationTabViewSource>("default");
  const hasUserSelectedRef = useRef(false);
  const hasTrackedOpenRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    if (!globalThis.chrome?.storage?.local) {
      setIsHydrated(true);
      return;
    }

    void getStorage<unknown>(storageKey)
      .then((storedValue) => {
        if (
          cancelled ||
          hasUserSelectedRef.current ||
          !includesValue(values, storedValue)
        ) {
          return;
        }

        initialViewSourceRef.current = "restored";
        setValue(storedValue);
      })
      .catch((error) => {
        captureErrorLog(`[Tabs] Failed to restore ${storageKey}:`, error);
      })
      .finally(() => {
        if (!cancelled) setIsHydrated(true);
      });

    return () => {
      cancelled = true;
    };
  }, [storageKey, values]);

  useEffect(() => {
    if (!open) {
      hasTrackedOpenRef.current = false;
      return;
    }

    if (!isHydrated || hasTrackedOpenRef.current) return;

    hasTrackedOpenRef.current = true;
    void sendNavigationTabView(
      featureArea,
      value,
      initialViewSourceRef.current,
    );
  }, [featureArea, isHydrated, open, value]);

  const onValueChange = useCallback(
    (nextValue: string) => {
      if (!includesValue(values, nextValue) || nextValue === value) return;

      hasUserSelectedRef.current = true;
      initialViewSourceRef.current = "restored";
      setValue(nextValue);

      if (globalThis.chrome?.storage?.local) {
        void setStorage({ [storageKey]: nextValue }).catch((error) => {
          captureErrorLog(`[Tabs] Failed to persist ${storageKey}:`, error);
        });
      }

      if (open) {
        hasTrackedOpenRef.current = true;
        void sendNavigationTabView(featureArea, nextValue, "user_select");
      }
    },
    [featureArea, open, storageKey, value, values],
  );

  return { value, onValueChange };
}
