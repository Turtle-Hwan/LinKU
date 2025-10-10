// activeTab permission
export const getCurrentTab = async () => {
  const queryOptions = { active: true, currentWindow: true };
  const tabs = await chrome.tabs?.query(queryOptions);
  if (!tabs) {
    return null;
  }
  const [tab] = tabs;
  return tab;
};

export const updateTabUrl = (url: string) => {
  chrome.tabs.update({ url: url });
};

export const executeScript = async (tabId: number, func: () => void) => {
  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: func,
    });
    // console.log("Injection Success", result);
    return result;
  } catch (err) {
    console.log("err", err);
    throw err;
  }
};

export const executeScriptFile = async (tabId: number, files: string[]) => {
  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files,
    });
    // console.log("Injection Success", result);
    return result;
  } catch (err) {
    console.log("err", err);
    throw err;
  }
};

// Chrome Storage API Promise 래퍼
export const getStorage = <T>(key: string): Promise<T | undefined> => {
  return new Promise((resolve, reject) => {
    chrome?.storage?.local?.get(key, (data) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(data[key]);
      }
    });
  });
};

export const setStorage = <T extends Record<string, unknown>>(
  data: T
): Promise<void> => {
  return new Promise((resolve, reject) => {
    chrome?.storage?.local?.set(data, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
};

export const removeStorage = (key: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    chrome?.storage?.local?.remove(key, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
};
