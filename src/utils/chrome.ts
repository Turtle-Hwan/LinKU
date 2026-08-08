import { errorLog } from '@/utils/logger';

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

  const queryOptions = { active: true, currentWindow: true };
  const tabs = await chromeApi.tabs.query(queryOptions);
  if (!tabs) {
    return null;
  }
  const [tab] = tabs;
  return tab ?? null;
};

export const updateTabUrl = (url: string) => {
  const chromeApi = getChromeApi();
  if (!chromeApi?.tabs?.update) {
    window.open(url, '_blank');
    return;
  }

  chromeApi.tabs.update({ url });
};

export const executeScript = async (tabId: number, func: () => void) => {
  const chromeApi = getChromeApi();
  if (!chromeApi?.scripting?.executeScript) {
    throw new Error('chrome.scripting is unavailable in this environment.');
  }

  try {
    const result = await chromeApi.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: func,
    });
    // debugLog("Injection Success", result);
    return result;
  } catch (err) {
    errorLog("[Chrome] Failed to execute inline script", err);
    throw err;
  }
};

export const executeScriptFile = async (tabId: number, files: string[]) => {
  const chromeApi = getChromeApi();
  if (!chromeApi?.scripting?.executeScript) {
    throw new Error('chrome.scripting is unavailable in this environment.');
  }

  try {
    const result = await chromeApi.scripting.executeScript({
      target: { tabId, allFrames: true },
      files,
    });
    // debugLog("Injection Success", result);
    return result;
  } catch (err) {
    errorLog("[Chrome] Failed to execute script file", err);
    throw err;
  }
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
      if (chromeApi.runtime?.lastError) {
        reject(chromeApi.runtime.lastError);
      } else {
        resolve(data[key] as T | undefined);
      }
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
      if (chromeApi.runtime?.lastError) {
        reject(chromeApi.runtime.lastError);
      } else {
        resolve();
      }
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
      if (chromeApi.runtime?.lastError) {
        reject(chromeApi.runtime.lastError);
      } else {
        resolve();
      }
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
