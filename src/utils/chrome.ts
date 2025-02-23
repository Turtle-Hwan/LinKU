export async function getCurrentTab() {
  const queryOptions = { active: true, lastFocusedWindow: true };
  const [tab] = await chrome.tabs.query(queryOptions);
  return tab;
}

export async function executeScript(tabId: number, func: () => void) {
  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func,
    });
    console.log("Injection Success", result);
    return result;
  } catch (err) {
    console.log("err", err);
    throw err;
  }
}

export async function executeScriptFile(tabId: number, files: string[]) {
  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files,
    });
    console.log("Injection Success", result);
    return result;
  } catch (err) {
    console.log("err", err);
    throw err;
  }
}
