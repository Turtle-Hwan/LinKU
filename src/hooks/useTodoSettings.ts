/**
 * Todo 설정 관리 Hook (정렬, 필터, 타이머)
 */
import { useState, useEffect, useCallback } from 'react';
import { addStorageChangeListener, getStorage, setStorage } from '@/utils/chrome';

type SortMethod = 'dday-asc' | 'dday-desc';
type FilterMode = 'all' | 'incomplete';

const SORT_METHOD_KEY = "todoSortMethod";
const FILTER_MODE_KEY = "todoFilterMode";
const TIMER_ENABLED_KEY = "realtimeTimerEnabled";

export function useTodoSettings() {
  const [sortMethod, setSortMethod] = useState<SortMethod>('dday-desc');
  const [filterMode, setFilterMode] = useState<FilterMode>('incomplete');
  const [timerEnabled, setTimerEnabled] = useState(true);

  /**
   * Load sort method from storage
   */
  useEffect(() => {
    const loadSortMethod = async () => {
      const saved = await getStorage<SortMethod>(SORT_METHOD_KEY);
      if (saved) {
        setSortMethod(saved);
      }
    };
    loadSortMethod();
  }, []);

  /**
   * Load filter mode from storage
   */
  useEffect(() => {
    const loadFilterMode = async () => {
      const saved = await getStorage<FilterMode>(FILTER_MODE_KEY);
      if (saved) {
        setFilterMode(saved);
      }
    };
    loadFilterMode();
  }, []);

  /**
   * Load timer setting and listen for changes
   */
  useEffect(() => {
    const loadTimerSetting = async () => {
      const enabled = await getStorage<boolean>(TIMER_ENABLED_KEY);
      setTimerEnabled(enabled ?? true);
    };
    loadTimerSetting();

    // Listen for storage changes
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === "local" && changes[TIMER_ENABLED_KEY]) {
        setTimerEnabled(changes[TIMER_ENABLED_KEY].newValue ?? true);
      }
    };

    return addStorageChangeListener(handleStorageChange);
  }, []);

  /**
   * Toggle sort method
   */
  const toggleSortMethod = useCallback(async () => {
    const nextMethod: SortMethod =
      sortMethod === 'dday-asc' ? 'dday-desc' : 'dday-asc';
    setSortMethod(nextMethod);
    await setStorage({ [SORT_METHOD_KEY]: nextMethod });
  }, [sortMethod]);

  /**
   * Toggle filter mode
   */
  const toggleFilterMode = useCallback(async () => {
    const nextMode: FilterMode =
      filterMode === 'incomplete' ? 'all' : 'incomplete';
    setFilterMode(nextMode);
    await setStorage({ [FILTER_MODE_KEY]: nextMode });
  }, [filterMode]);

  return {
    sortMethod,
    filterMode,
    timerEnabled,
    toggleSortMethod,
    toggleFilterMode,
  };
}

export type { SortMethod, FilterMode };
