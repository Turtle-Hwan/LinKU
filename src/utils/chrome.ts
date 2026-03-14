const getChromeApi = (): typeof chrome | undefined => {
  return globalThis.chrome;
};

export const isExtensionEnvironment = (): boolean => {
  const chromeApi = getChromeApi();
  return Boolean(chromeApi?.runtime?.id);
};

// activeTab permission
export const getCurrentTab = async () => {
  const chromeApi = getChromeApi();
  if (!chromeApi?.tabs?.query) {
    return null;
  }

  const queryOptions = { active: true, currentWindow: true };
  const tabs = await chromeApi.tabs.query(queryOptions);
  const [tab] = tabs;
  return tab ?? null;
};

export const updateTabUrl = (url: string) => {
  const chromeApi = getChromeApi();
  if (!chromeApi?.tabs?.update) {
    window.open(url, "_blank");
    return;
  }

  chromeApi.tabs.update({ url });
};

export const executeScript = async (tabId: number, func: () => void) => {
  const chromeApi = getChromeApi();
  if (!chromeApi?.scripting?.executeScript) {
    throw new Error("chrome.scripting is unavailable in this environment.");
  }

  try {
    return await chromeApi.scripting.executeScript({
      target: { tabId, allFrames: true },
      func,
    });
  } catch (err) {
    console.log("err", err);
    throw err;
  }
};

export const executeScriptFile = async (tabId: number, files: string[]) => {
  const chromeApi = getChromeApi();
  if (!chromeApi?.scripting?.executeScript) {
    throw new Error("chrome.scripting is unavailable in this environment.");
  }

  try {
    return await chromeApi.scripting.executeScript({
      target: { tabId, allFrames: true },
      files,
    });
  } catch (err) {
    console.log("err", err);
    throw err;
  }
};

// Chrome Storage API Promise wrapper
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
  data: T
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
  listener: (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => void
) => {
  const chromeApi = getChromeApi();
  if (!chromeApi?.storage?.onChanged?.addListener) {
    return () => {};
  }

  chromeApi.storage.onChanged.addListener(listener);
  return () => {
    chromeApi.storage.onChanged.removeListener(listener);
  };
};

export { getChromeApi };
