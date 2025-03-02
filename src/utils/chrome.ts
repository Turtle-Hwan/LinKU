// activeTab permission
export const getCurrentTab = async () => {
  const queryOptions = { active: true, currentWindow: true };
  const [tab] = await chrome.tabs.query(queryOptions);
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
