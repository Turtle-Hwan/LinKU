import {
  createErrorReporter,
  recordBreadcrumb,
} from "@/monitoring";

const reportChromeError = createErrorReporter({
  category: "chrome.api",
  mechanism: "chrome.api",
});

function reportChromeFailure(
  error: unknown,
  feature: string,
  extras: Record<string, unknown> = {},
): void {
  reportChromeError(error, {
    feature: `chrome_${feature}`,
    breadcrumbMessage: `${feature} failed`,
    extras,
  });
}

function getStorageKeyCount(key: string | string[]): number {
  return Array.isArray(key) ? key.length : 1;
}

function createChromeRuntimeError(
  lastError: chrome.runtime.LastError,
  operation: string,
): Error {
  return Object.assign(
    new Error(lastError.message ?? `Chrome ${operation} failed.`),
    {
      name: "ChromeRuntimeError",
      cause: lastError,
    },
  );
}

export const getChromeApi = (): typeof chrome | undefined => {
  return globalThis.chrome;
};

export const isExtensionEnvironment = (): boolean => {
  return Boolean(getChromeApi()?.runtime?.id);
};

// activeTab permission
export const getCurrentTab = async () => {
  const chromeApi = getChromeApi();
  if (!chromeApi?.tabs?.query) {
    return null;
  }

  try {
    const queryOptions = { active: true, currentWindow: true };
    const tabs = await chromeApi.tabs.query(queryOptions);
    if (!tabs) {
      return null;
    }
    const [tab] = tabs;
    recordBreadcrumb("chrome.api", "active tab queried", {
      result_count: tabs.length,
      has_tab_id: typeof tab?.id === "number",
    });
    return tab ?? null;
  } catch (error) {
    reportChromeFailure(error, "tabs_query");
    return null;
  }
};

export const updateTabUrl = (url: string) => {
  const chromeApi = getChromeApi();
  if (!chromeApi?.tabs?.update) {
    window.open(url, '_blank');
    return;
  }

  try {
    void chromeApi.tabs.update({ url }).catch((error: unknown) => {
      reportChromeFailure(error, "tabs_update");
    });
  } catch (error) {
    reportChromeFailure(error, "tabs_update");
  }
};

export const executeScript = async (tabId: number, func: () => void) => {
  const chromeApi = getChromeApi();
  if (!chromeApi?.scripting?.executeScript) {
    throw new Error("chrome.scripting is unavailable in this environment.");
  }

  const result = await chromeApi.scripting.executeScript({
    target: { tabId, allFrames: true },
    func: func,
  });
  recordBreadcrumb("chrome.api", "inline script executed", {
    tab_id: tabId,
    all_frames: true,
  });
  return result;
};

export const executeScriptFile = async (tabId: number, files: string[]) => {
  const chromeApi = getChromeApi();
  if (!chromeApi?.scripting?.executeScript) {
    throw new Error("chrome.scripting is unavailable in this environment.");
  }

  const result = await chromeApi.scripting.executeScript({
    target: { tabId, allFrames: true },
    files,
  });
  recordBreadcrumb("chrome.api", "script file executed", {
    tab_id: tabId,
    file_count: files.length,
    all_frames: true,
  });
  return result;
};

// Chrome Storage API Promise 래퍼
export const getStorage = <T>(key: string): Promise<T | undefined> => {
  return new Promise((resolve, reject) => {
    const chromeApi = getChromeApi();
    if (!chromeApi?.storage?.local) {
      resolve(undefined);
      return;
    }

    chromeApi.storage.local.get(key, (data) => {
      const lastError = chromeApi.runtime?.lastError;
      if (lastError) {
        reject(createChromeRuntimeError(lastError, "storage.get"));
        return;
      }

      recordBreadcrumb("chrome.api", "storage value read", {
        key_count: 1,
      });
      resolve(data?.[key] as T | undefined);
    });
  });
};

export const setStorage = <T extends Record<string, unknown>>(
  data: T,
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const chromeApi = getChromeApi();
    if (!chromeApi?.storage?.local) {
      resolve();
      return;
    }

    chromeApi.storage.local.set(data, () => {
      const lastError = chromeApi.runtime?.lastError;
      if (lastError) {
        reject(createChromeRuntimeError(lastError, "storage.set"));
        return;
      }

      recordBreadcrumb("chrome.api", "storage values written", {
        key_count: Object.keys(data).length,
      });
      resolve();
    });
  });
};

export const removeStorage = (key: string | string[]): Promise<void> => {
  return new Promise((resolve, reject) => {
    const chromeApi = getChromeApi();
    if (!chromeApi?.storage?.local) {
      resolve();
      return;
    }

    chromeApi.storage.local.remove(key, () => {
      const lastError = chromeApi.runtime?.lastError;
      if (lastError) {
        reject(createChromeRuntimeError(lastError, "storage.remove"));
        return;
      }

      recordBreadcrumb("chrome.api", "storage values removed", {
        key_count: getStorageKeyCount(key),
      });
      resolve();
    });
  });
};

export const addStorageChangeListener = (
  listener: (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ) => void,
): (() => void) => {
  const onChanged = getChromeApi()?.storage?.onChanged;
  if (!onChanged?.addListener) {
    return () => {};
  }

  onChanged.addListener(listener);
  return () => {
    onChanged.removeListener(listener);
  };
};
