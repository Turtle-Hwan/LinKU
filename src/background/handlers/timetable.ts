import type {
  EverytimeTimetable,
  PendingEverytimeImport,
  TimetableImportMode,
  TimetableImportResponse,
} from "@/types/timetable";
import { TIMETABLE_STORAGE_KEYS } from "@/types/timetable";
import {
  getActiveTimetable,
  getEverytimeTimetableAssetId,
  getImportedEverytimeSemesters,
  markEverytimeSemestersImported,
  saveEverytimeTimetable,
  setActiveTimetable,
} from "@/utils/timetableStorage";
import { getErrorLogDetails, warnLog } from "@/utils/logger";
import {
  getLatestEverytimeSemesterAnchor,
  parseEverytimeSemester,
  type EverytimeSemesterPeriod,
} from "@/utils/everytimeSemester";

const EVERYTIME_TIMETABLE_URL = "https://everytime.kr/timetable";
const EVERYTIME_TIMETABLE_PATTERN = "https://everytime.kr/timetable*";
const CONTENT_SCRIPT_PATH = "content/everytime-timetable.js";
const TAB_LOAD_TIMEOUT_MS = 15_000;
const RECENT_SEMESTER_COUNT = 4;

interface SemesterListResponse {
  success: true;
  semesters: string[];
  currentSemester?: string;
}

interface SemesterFetchResponse {
  success: true;
  timetables: EverytimeTimetable[];
  skippedSemesters: string[];
}

interface CurrentTimetableResponse {
  success: true;
  timetable: EverytimeTimetable | null;
}

interface TimetableSearchResult extends SemesterFetchResponse {
  searchedSemesters: string[];
}

interface CaptureFailureResponse {
  success: false;
  error: string;
}

type EverytimeResponse =
  | SemesterListResponse
  | SemesterFetchResponse
  | CurrentTimetableResponse
  | CaptureFailureResponse
  | { success: true; ready: true };

const importJobs = new Map<number, Promise<TimetableImportResponse>>();

function hasTimetableData(timetable: EverytimeTimetable | null): timetable is EverytimeTimetable {
  return (
    timetable != null &&
    (timetable.subjects.length > 0 || (timetable.courses?.length ?? 0) > 0)
  );
}

function isEverytimeLoginUrl(url?: string): boolean {
  if (!url) {
    return false;
  }

  try {
    const parsedUrl = new URL(url);
    return (
      parsedUrl.hostname === "account.everytime.kr" ||
      (parsedUrl.hostname === "everytime.kr" &&
        parsedUrl.pathname.startsWith("/login"))
    );
  } catch {
    return false;
  }
}

function isEverytimeTimetableUrl(url?: string): boolean {
  if (!url) {
    return false;
  }

  try {
    const parsedUrl = new URL(url);
    return (
      parsedUrl.hostname === "everytime.kr" &&
      parsedUrl.pathname.startsWith("/timetable")
    );
  } catch {
    return false;
  }
}

async function getPendingImport(): Promise<PendingEverytimeImport | null> {
  const stored = await chrome.storage.session.get(
    TIMETABLE_STORAGE_KEYS.pendingImport,
  );

  return (
    (stored[
      TIMETABLE_STORAGE_KEYS.pendingImport
    ] as PendingEverytimeImport | undefined) ?? null
  );
}

async function setPendingImport(
  pendingImport: PendingEverytimeImport,
): Promise<void> {
  await chrome.storage.session.set({
    [TIMETABLE_STORAGE_KEYS.pendingImport]: pendingImport,
  });
}

async function clearPendingImport(): Promise<void> {
  await chrome.storage.session.remove(TIMETABLE_STORAGE_KEYS.pendingImport);
}

async function waitForTabToSettle(tabId: number): Promise<chrome.tabs.Tab> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = (): void => {
      clearTimeout(timeoutId);
      chrome.tabs.onUpdated.removeListener(handleUpdated);
    };
    const resolveOnce = (tab: chrome.tabs.Tab): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(tab);
    };
    const rejectOnce = (error: unknown): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    };

    const timeoutId = setTimeout(() => {
      rejectOnce(
        new Error("에브리타임 페이지를 불러오는 데 시간이 걸리고 있습니다."),
      );
    }, TAB_LOAD_TIMEOUT_MS);

    function handleUpdated(
      updatedTabId: number,
      changeInfo: chrome.tabs.OnUpdatedInfo,
      updatedTab: chrome.tabs.Tab,
    ): void {
      if (updatedTabId !== tabId || changeInfo.status !== "complete") {
        return;
      }

      resolveOnce(updatedTab);
    }

    chrome.tabs.onUpdated.addListener(handleUpdated);
    chrome.tabs
      .get(tabId)
      .then((currentTab) => {
        if (currentTab.status === "complete") {
          resolveOnce(currentTab);
        }
      })
      .catch(rejectOnce);
  });
}

async function ensureContentScript(tabId: number): Promise<void> {
  try {
    const response = (await chrome.tabs.sendMessage(tabId, {
      type: "LINKU_EVERYTIME_CAPTURE_PING",
    })) as EverytimeResponse | undefined;

    if (response?.success) {
      return;
    }
  } catch {
    // Existing tabs opened before an extension reload need one explicit injection.
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: [CONTENT_SCRIPT_PATH],
  });

  await chrome.tabs.sendMessage(tabId, {
    type: "LINKU_EVERYTIME_CAPTURE_PING",
  });
}

async function closeOwnedTab(tabId: number): Promise<void> {
  try {
    await chrome.tabs.remove(tabId);
  } catch {
    // The user may have closed the temporary login tab first.
  }
}

function isSemesterListResponse(
  response: EverytimeResponse | undefined,
): response is SemesterListResponse {
  return response?.success === true && "semesters" in response;
}

function isCurrentTimetableResponse(
  response: EverytimeResponse | undefined,
): response is CurrentTimetableResponse {
  return response?.success === true && "timetable" in response;
}

function isSemesterFetchResponse(
  response: EverytimeResponse | undefined,
): response is SemesterFetchResponse {
  return response?.success === true && "timetables" in response;
}

function getEverytimeResponseError(
  response: EverytimeResponse | undefined,
  fallback: string,
): string {
  return response?.success === false ? response.error : fallback;
}

async function listSemesters(tabId: number): Promise<SemesterListResponse> {
  await ensureContentScript(tabId);
  const response = (await chrome.tabs.sendMessage(tabId, {
    type: "LINKU_EVERYTIME_LIST_SEMESTERS",
  })) as EverytimeResponse | undefined;

  if (!isSemesterListResponse(response) || response.semesters.length === 0) {
    throw new Error("에브리타임의 학기 목록을 확인하지 못했습니다.");
  }

  return response;
}

async function captureRenderedTimetable(
  tabId: number,
  semester: string,
): Promise<EverytimeTimetable | null> {
  await ensureContentScript(tabId);
  const response = (await chrome.tabs.sendMessage(tabId, {
    type: "LINKU_EVERYTIME_CAPTURE_CURRENT",
    data: { semester },
  })) as EverytimeResponse | undefined;

  if (!isCurrentTimetableResponse(response)) {
    throw new Error(
      getEverytimeResponseError(
        response,
        "에브리타임 시간표를 불러오지 못했습니다.",
      ),
    );
  }

  return response.timetable;
}

async function fetchSemestersFromApi(
  tabId: number,
  semesters: string[],
): Promise<SemesterFetchResponse> {
  await ensureContentScript(tabId);
  const response = (await chrome.tabs.sendMessage(tabId, {
    type: "LINKU_EVERYTIME_FETCH_SEMESTERS",
    data: { semesters },
  })) as EverytimeResponse | undefined;

  if (!isSemesterFetchResponse(response)) {
    throw new Error(
      getEverytimeResponseError(
        response,
        "에브리타임 시간표 API를 불러오지 못했습니다.",
      ),
    );
  }

  return response;
}

function getSemesterUrl(semester: string): string | null {
  const period = parseEverytimeSemester(semester);
  if (!period) {
    return null;
  }

  return `${EVERYTIME_TIMETABLE_URL}/${period.year}/${encodeURIComponent(period.term)}`;
}

async function captureSemesterInTemporaryTab(
  semester: string,
): Promise<EverytimeTimetable | null> {
  const url = getSemesterUrl(semester);
  if (!url) {
    return null;
  }

  const tab = await chrome.tabs.create({ url, active: false });
  if (tab.id == null) {
    throw new Error("에브리타임 시간표 탭을 열지 못했습니다.");
  }

  try {
    const loadedTab = await waitForTabToSettle(tab.id);
    if (isEverytimeLoginUrl(loadedTab.url)) {
      throw new Error("에브리타임 로그인이 필요합니다.");
    }

    if (!isEverytimeTimetableUrl(loadedTab.url)) {
      return null;
    }

    return await captureRenderedTimetable(tab.id, semester);
  } finally {
    await closeOwnedTab(tab.id);
  }
}

async function captureSemesterBatch(
  semesters: string[],
): Promise<SemesterFetchResponse> {
  const captures = await Promise.all(
    semesters.map(async (semester) => ({
      semester,
      timetable: await captureSemesterInTemporaryTab(semester),
    })),
  );
  const timetables = captures
    .map(({ timetable }) => timetable)
    .filter(hasTimetableData);

  return {
    success: true,
    timetables,
    skippedSemesters: captures
      .filter(({ timetable }) => !hasTimetableData(timetable))
      .map(({ semester }) => semester),
  };
}

async function getImportSemesterCandidates(
  mode: TimetableImportMode,
  list: SemesterListResponse,
): Promise<string[]> {
  const periods = list.semesters
    .map(parseEverytimeSemester)
    .filter((period): period is EverytimeSemesterPeriod => period != null)
    .sort((left, right) => right.sortKey - left.sortKey);

  if (mode === "latest") {
    const anchor = getLatestEverytimeSemesterAnchor(new Date());
    return periods
      .filter((period) => period.sortKey <= anchor.sortKey)
      .map((period) => period.label);
  }

  const importedSemesters = await getImportedEverytimeSemesters();
  const importedPeriods = importedSemesters
    .map(parseEverytimeSemester)
    .filter((period): period is EverytimeSemesterPeriod => period != null);
  if (importedPeriods.length === 0) {
    return [];
  }

  const oldestImportedSortKey = Math.min(
    ...importedPeriods.map((period) => period.sortKey),
  );
  return periods
    .filter((period) => period.sortKey < oldestImportedSortKey)
    .map((period) => period.label);
}

async function findFirstPopulatedSemesterBatch(
  tabId: number,
  semesterCandidates: string[],
): Promise<TimetableSearchResult | null> {
  const searchedSemesters: string[] = [];
  const skippedSemesters: string[] = [];

  for (
    let startIndex = 0;
    startIndex < semesterCandidates.length;
    startIndex += RECENT_SEMESTER_COUNT
  ) {
    const semesters = semesterCandidates.slice(
      startIndex,
      startIndex + RECENT_SEMESTER_COUNT,
    );
    let response: SemesterFetchResponse;
    try {
      response = await fetchSemestersFromApi(tabId, semesters);
    } catch (error) {
      warnLog(
        "[Timetable] Everytime API unavailable; using rendered DOM fallback",
        getErrorLogDetails(error),
      );
      response = await captureSemesterBatch(semesters);
    }

    searchedSemesters.push(...semesters);
    skippedSemesters.push(...response.skippedSemesters);

    if (response.timetables.length > 0) {
      return {
        ...response,
        skippedSemesters,
        searchedSemesters,
      };
    }
  }

  return null;
}

async function importSemesterBatchFromTab(
  tabId: number,
  createdByLinku: boolean,
  mode: TimetableImportMode,
): Promise<TimetableImportResponse> {
  const existingJob = importJobs.get(tabId);
  if (existingJob) {
    return existingJob;
  }

  const job = (async (): Promise<TimetableImportResponse> => {
    let keepOwnedTabOpen = false;

    try {
      const sourceTab = await waitForTabToSettle(tabId);
      if (isEverytimeLoginUrl(sourceTab.url)) {
        keepOwnedTabOpen = true;
        await setPendingImport({
          tabId,
          // 로그인 탭을 사용자에게 활성화한 뒤에는 더 이상 임시 탭으로
          // 취급하지 않는다. 로그인 완료 후 foreground 탭을 닫지 않는다.
          createdByLinku: false,
          requestedAt: new Date().toISOString(),
          mode,
        });
        await chrome.tabs.update(tabId, { active: true });

        return {
          success: false,
          code: "LOGIN_REQUIRED",
          error: "열린 에브리타임 탭에서 로그인하면 시간표를 자동으로 가져옵니다.",
          loginTabId: tabId,
        };
      }

      if (!isEverytimeTimetableUrl(sourceTab.url)) {
        return {
          success: false,
          code: "TAB_UNAVAILABLE",
          error: "에브리타임 시간표 페이지를 열 수 없습니다.",
        };
      }

      const semesterList = await listSemesters(tabId);
      const semesterCandidates = await getImportSemesterCandidates(
        mode,
        semesterList,
      );
      if (semesterCandidates.length === 0) {
        return {
          success: false,
          code: "NO_PREVIOUS_SEMESTERS",
          error:
            mode === "previous"
              ? "더 이전의 시간표가 없습니다."
              : "가져올 최신 시간표가 없습니다.",
        };
      }

      const response = await findFirstPopulatedSemesterBatch(
        tabId,
        semesterCandidates,
      );
      if (!response) {
        return {
          success: false,
          code: "TIMETABLE_NOT_FOUND",
          error:
            mode === "previous"
              ? "더 이전 학기에서 수업이 있는 시간표를 찾지 못했습니다."
              : "에브리타임에 저장된 시간표를 찾지 못했습니다.",
        };
      }

      const existingActiveTimetable = await getActiveTimetable();
      const results: Array<
        Awaited<ReturnType<typeof saveEverytimeTimetable>>
      > = [];
      for (const timetable of response.timetables) {
        // Each save performs a read-modify-write on the shared asset index.
        // Keep this sequential so concurrent semester saves cannot overwrite
        // one another while appending to the collection.
        results.push(await saveEverytimeTimetable(timetable));
      }
      const activeSemester = semesterList.currentSemester;
      const activeTimetable =
        response.timetables.find(
          (timetable) => timetable.semester === activeSemester,
        ) ?? response.timetables[0];
      if (!existingActiveTimetable && activeTimetable) {
        await setActiveTimetable(
          getEverytimeTimetableAssetId(activeTimetable.semester),
        );
      }

      await Promise.all([
        markEverytimeSemestersImported(response.searchedSemesters),
        clearPendingImport(),
      ]);

      return {
        success: true,
        activeAssetId:
          existingActiveTimetable?.meta.id ??
          (activeTimetable
            ? getEverytimeTimetableAssetId(activeTimetable.semester)
            : null),
        importedCount: response.timetables.length,
        updatedCount: results.filter((result) => result.changed).length,
        skippedCount: response.skippedSemesters.length,
      };
    } catch (error) {
      warnLog(
        "[Timetable] Everytime import failed",
        getErrorLogDetails(error),
      );

      return {
        success: false,
        code: "CAPTURE_FAILED",
        error:
          error instanceof Error
            ? error.message
            : "에브리타임 시간표를 가져오지 못했습니다.",
      };
    } finally {
      if (createdByLinku && !keepOwnedTabOpen) {
        await closeOwnedTab(tabId);
      }
    }
  })();

  importJobs.set(tabId, job);

  try {
    return await job;
  } finally {
    importJobs.delete(tabId);
  }
}

async function findExistingTimetableTab(): Promise<chrome.tabs.Tab | null> {
  const tabs = await chrome.tabs.query({
    url: [EVERYTIME_TIMETABLE_PATTERN],
  });

  return (
    tabs
      .filter((tab): tab is chrome.tabs.Tab & { id: number } => tab.id != null)
      .sort(
        (left, right) =>
          (right.lastAccessed ?? 0) - (left.lastAccessed ?? 0),
      )[0] ?? null
  );
}

export async function handleTimetableImport(
  mode: TimetableImportMode = "latest",
): Promise<TimetableImportResponse> {
  const existingTab = await findExistingTimetableTab();
  if (existingTab?.id != null) {
    return importSemesterBatchFromTab(existingTab.id, false, mode);
  }

  const pendingImport = await getPendingImport();
  if (pendingImport) {
    try {
      const pendingTab = await chrome.tabs.get(pendingImport.tabId);
      if (
        isEverytimeLoginUrl(pendingTab.url) ||
        isEverytimeTimetableUrl(pendingTab.url)
      ) {
        return importSemesterBatchFromTab(
          pendingImport.tabId,
          pendingImport.createdByLinku,
          pendingImport.mode,
        );
      }
    } catch {
      await clearPendingImport();
    }
  }

  const createdTab = await chrome.tabs.create({
    url: EVERYTIME_TIMETABLE_URL,
    active: false,
  });

  if (createdTab.id == null) {
    return {
      success: false,
      code: "TAB_UNAVAILABLE",
      error: "에브리타임 탭을 열지 못했습니다.",
    };
  }

  return importSemesterBatchFromTab(createdTab.id, true, mode);
}

export async function handlePendingImportTabUpdated(
  tabId: number,
  changeInfo: chrome.tabs.OnUpdatedInfo,
  tab: chrome.tabs.Tab,
): Promise<void> {
  if (changeInfo.status !== "complete") {
    return;
  }

  const pendingImport = await getPendingImport();
  if (
    pendingImport?.tabId !== tabId ||
    !isEverytimeTimetableUrl(tab.url)
  ) {
    return;
  }

  await importSemesterBatchFromTab(
    tabId,
    pendingImport.createdByLinku,
    pendingImport.mode,
  );
}

export async function handlePendingImportTabRemoved(
  tabId: number,
): Promise<void> {
  const pendingImport = await getPendingImport();
  if (pendingImport?.tabId === tabId) {
    await clearPendingImport();
  }
}
