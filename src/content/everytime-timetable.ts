import type {
  EverytimeCourse,
  EverytimeSemesterMetadata,
  EverytimeSemesterTerm,
  EverytimeSubject,
  EverytimeTableMetadata,
  EverytimeTimetable,
} from "@/types/timetable";
import {
  DEFAULT_EVERYTIME_SUBJECT_COLOR,
  getStableEverytimeSubjectColor,
  isEverytimeSubjectColor,
} from "@/utils/everytimeTimetableColor";
import { isPrimaryEverytimeTable } from "@/utils/everytimeTimetableParsing";
import {
  createErrorReporter,
  createRuntimeMessageResponder,
  getRuntimeMessageType,
  initMonitoring,
  recordBreadcrumb,
} from "@/monitoring";

initMonitoring("content");

type CaptureRequest =
  | { type: "LINKU_EVERYTIME_CAPTURE_PING" }
  | { type: "LINKU_EVERYTIME_LIST_SEMESTERS" }
  | {
      type: "LINKU_EVERYTIME_CAPTURE_CURRENT";
      data: { semester: string };
    }
  | {
      type: "LINKU_EVERYTIME_FETCH_SEMESTERS";
      data: { semesters: string[] };
    };

type CaptureResponse =
  | { success: true; ready: true }
  | { success: true; semesters: string[]; currentSemester?: string }
  | { success: true; timetable: EverytimeTimetable | null }
  | { success: true; timetables: EverytimeTimetable[]; skippedSemesters: string[] }
  | { success: false; error: string };

const EVERYTIME_API_BASE_URL = "https://api.everytime.kr/find/timetable";
const EVERYTIME_SEMESTER_LIST_URL = `${EVERYTIME_API_BASE_URL}/subject/semester/list`;
const EVERYTIME_TABLE_LIST_URL = `${EVERYTIME_API_BASE_URL}/table/list/semester`;
const EVERYTIME_TABLE_DETAIL_URL = `${EVERYTIME_API_BASE_URL}/table`;
const EVERYTIME_SELECT_SELECTOR = "#semesters";
const EVERYTIME_TIMETABLE_SELECTOR = "#container.timetable";
const EVERYTIME_SEMESTER_PATTERN = /^(20\d{2})년\s*(1|2|여름|겨울)학기$/;
const SEMESTER_FETCH_CONCURRENCY = 4;
const EVERYTIME_TIME_UNIT_PX = 25 / 6;
const EVERYTIME_WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];
const TIMETABLE_RENDER_TIMEOUT_MS = 5_000;
const SEMESTER_LIST_RENDER_TIMEOUT_MS = 5_000;
const EVERYTIME_API_TIMEOUT_MS = 10_000;
const SEMESTER_METADATA_CACHE_TTL_MS = 5 * 60 * 1_000;

const captureContentException = createErrorReporter({
  category: "content.error",
  mechanism: "content.handler",
});

function reportContentException(error: unknown, feature: string): void {
  captureContentException(error, {
    feature,
    breadcrumbMessage: `${feature} captured`,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isCaptureRequest(value: unknown): value is CaptureRequest {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }

  if (
    value.type === "LINKU_EVERYTIME_CAPTURE_PING" ||
    value.type === "LINKU_EVERYTIME_LIST_SEMESTERS"
  ) {
    return true;
  }

  if (!isRecord(value.data)) {
    return false;
  }

  if (value.type === "LINKU_EVERYTIME_CAPTURE_CURRENT") {
    return typeof value.data.semester === "string";
  }

  return (
    value.type === "LINKU_EVERYTIME_FETCH_SEMESTERS" &&
    Array.isArray(value.data.semesters) &&
    value.data.semesters.every((semester) => typeof semester === "string")
  );
}

const linkuWindow = window as Window & {
  __LINKU_EVERYTIME_CAPTURE_INSTALLED__?: boolean;
};

if (!linkuWindow.__LINKU_EVERYTIME_CAPTURE_INSTALLED__) {
  linkuWindow.__LINKU_EVERYTIME_CAPTURE_INSTALLED__ = true;
  let semesterMetadataCache:
    | {
        expiresAt: number;
        value: Map<string, EverytimeSemesterMetadata>;
      }
    | undefined;

  const exactText = (element: Element | null): string =>
    element?.textContent?.replace(/\s+/g, " ").trim() ?? "";

  const isEverytimeSemesterTerm = (
    value?: string,
  ): value is EverytimeSemesterTerm =>
    value === "1" || value === "여름" || value === "2" || value === "겨울";

  const formatEverytimeSemester = (
    year: number,
    term: EverytimeSemesterTerm,
  ): string => `${year}년 ${term}학기`;

  const parseEverytimeSemester = (
    semester: string,
  ): { year: number; term: EverytimeSemesterTerm } | null => {
    const match = semester.match(EVERYTIME_SEMESTER_PATTERN);
    if (!match) {
      return null;
    }

    const year = Number.parseInt(match[1], 10);
    const term = match[2];
    return isEverytimeSemesterTerm(term) ? { year, term } : null;
  };

  const findTimetableRoot = (documentRoot: Document = document): HTMLElement | null =>
    documentRoot.querySelector<HTMLElement>(EVERYTIME_TIMETABLE_SELECTOR);

  const readSemester = (documentRoot: Document = document): string | undefined => {
    const select = documentRoot.querySelector<HTMLSelectElement>(
      EVERYTIME_SELECT_SELECTOR,
    );
    const selectedOption = select?.selectedOptions.item(0);
    const selectedSemester = exactText(selectedOption ?? null);
    if (EVERYTIME_SEMESTER_PATTERN.test(selectedSemester)) {
      return selectedSemester;
    }

    if (
      select?.value &&
      EVERYTIME_SEMESTER_PATTERN.test(select.value.trim())
    ) {
      return select.value.trim();
    }

    const semesterPattern = /20\d{2}\s*년?\s*(?:1|2|여름|겨울)\s*학기/;
    const headings = Array.from(documentRoot.querySelectorAll("h1, h2, h3, option"));
    const match = headings
      .map((heading) => exactText(heading).match(semesterPattern))
      .find((candidate) => candidate != null);

    return match?.[0].replace(/\s+/g, " ").trim();
  };

  const readSemesterOptions = (): string[] => {
    const select = document.querySelector<HTMLSelectElement>(
      EVERYTIME_SELECT_SELECTOR,
    );
    if (!select) {
      return [];
    }

    return Array.from(select.options)
      .map((option) => option.textContent?.trim() ?? "")
      .filter((semester) => EVERYTIME_SEMESTER_PATTERN.test(semester));
  };

  const parsePixel = (value: string | null): number => {
    const parsed = Number.parseFloat(value ?? "");
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const readAttribute = (
    element: Element,
    ...attributeNames: string[]
  ): string | undefined => {
    for (const attributeName of attributeNames) {
      const value = element.getAttribute(attributeName)?.trim();
      if (value) {
        return value;
      }
    }

    return undefined;
  };

  const readValue = (element: Element, selector: string): string | undefined => {
    const valueElement = element.querySelector(selector);
    return valueElement ? readAttribute(valueElement, "value") : undefined;
  };

  const parseOptionalNumber = (value?: string): number | undefined => {
    if (!value) {
      return undefined;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const parseOptionalFlag = (value?: string): boolean | undefined => {
    if (value === undefined) {
      return undefined;
    }

    return value === "1";
  };

  const getColorClass = (subject: Element): string =>
    Array.from(subject.classList).find(isEverytimeSubjectColor) ??
    DEFAULT_EVERYTIME_SUBJECT_COLOR;

  const parseTimetable = (
    documentRoot: Document,
    expectedSemester: string,
  ): EverytimeTimetable | null => {
    const root = findTimetableRoot(documentRoot);
    const bodyTable = root?.querySelector("table.tablebody");
    if (!root || !bodyTable) {
      return null;
    }

    const weekdays = Array.from(
      root.querySelectorAll("table.tablehead th, table.tablehead td"),
    )
      .map((cell) => exactText(cell))
      .filter(Boolean)
      .filter((label) => ["월", "화", "수", "목", "금", "토", "일"].includes(label));
    const cells = Array.from(bodyTable.querySelectorAll("td"));
    const subjects: EverytimeSubject[] = [];

    cells.forEach((cell, dayIndex) => {
      if (dayIndex >= weekdays.length) {
        return;
      }

      const subjectElements = Array.from(
        cell.querySelectorAll(":scope > div.cols > div.subject"),
      );

      subjectElements.forEach((subject, subjectIndex) => {
        const top = parsePixel(subject.getAttribute("style")?.match(/top:\s*([^;]+)/)?.[1] ?? null);
        const height = parsePixel(
          subject.getAttribute("style")?.match(/height:\s*([^;]+)/)?.[1] ?? null,
        );
        const title = exactText(subject.querySelector("h3"));
        if (!title || height <= 0) {
          return;
        }

        const detailElement = subject.querySelector("p");
        const professor = exactText(detailElement?.querySelector("em") ?? null);
        const rawDetail = exactText(detailElement);
        const place = professor
          ? rawDetail.slice(professor.length).trim()
          : rawDetail;
        const startTime = Math.round(top / EVERYTIME_TIME_UNIT_PX);
        const endTime = Math.round((top + height) / EVERYTIME_TIME_UNIT_PX);

        subjects.push({
          id: `${expectedSemester}:${dayIndex}:${top}:${subjectIndex}`,
          dayIndex,
          title,
          professor: professor || undefined,
          place: place || undefined,
          detail: [professor, place].filter(Boolean).join(" · ") || undefined,
          color: getColorClass(subject),
          startTime,
          endTime,
          top,
          height,
        });
      });
    });

    const firstGrid = bodyTable.querySelector("td div.grids");
    const hourGridCount = firstGrid?.querySelectorAll(":scope > div.grid").length ?? 0;
    return {
      semester: readSemester(documentRoot) ?? expectedSemester,
      weekdays,
      slotCount: Math.max(1, hourGridCount * 2),
      subjects,
    };
  };

  // Everytime renders the semester <select> client-side, so a tab that just
  // reported `status: "complete"` usually has an empty list. Reading it in the
  // same tick reports "no semesters" for a page that is merely still rendering.
  const waitForSemesterOptions = (): Promise<string[]> =>
    new Promise((resolve) => {
      const resolveSemesterOptions = (): boolean => {
        const semesters = readSemesterOptions();
        if (semesters.length > 0) {
          cleanup();
          resolve(semesters);
          return true;
        }

        return false;
      };

      const observer = new MutationObserver(resolveSemesterOptions);
      const timeoutId = window.setTimeout(() => {
        cleanup();
        resolve(readSemesterOptions());
      }, SEMESTER_LIST_RENDER_TIMEOUT_MS);
      const cleanup = (): void => {
        observer.disconnect();
        window.clearTimeout(timeoutId);
      };

      if (resolveSemesterOptions()) {
        return;
      }

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    });

  const waitForRenderedTimetable = (
    semester: string,
  ): Promise<EverytimeTimetable | null> =>
    new Promise((resolve) => {
      const resolveRenderedTimetable = (): boolean => {
        const timetable = parseTimetable(document, semester);
        if (timetable?.subjects.length) {
          cleanup();
          resolve(timetable);
          return true;
        }

        return false;
      };

      const observer = new MutationObserver(resolveRenderedTimetable);
      const timeoutId = window.setTimeout(() => {
        cleanup();
        resolve(parseTimetable(document, semester));
      }, TIMETABLE_RENDER_TIMEOUT_MS);
      const cleanup = (): void => {
        observer.disconnect();
        window.clearTimeout(timeoutId);
      };

      if (resolveRenderedTimetable()) {
        return;
      }

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    });

  const fetchEverytimeXml = async (
    url: string,
    body: URLSearchParams,
  ): Promise<Document> => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      EVERYTIME_API_TIMEOUT_MS,
    );

    try {
      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/xml, text/xml, */*; q=0.01",
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        body: body.toString(),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error("에브리타임 시간표 API를 불러오지 못했습니다.");
      }

      const documentRoot = new DOMParser().parseFromString(
        await response.text(),
        "application/xml",
      );
      if (
        documentRoot.querySelector("parsererror") ||
        documentRoot.querySelector("response > error")
      ) {
        throw new Error("에브리타임 시간표 응답을 해석하지 못했습니다.");
      }

      return documentRoot;
    } catch (error) {
      if (controller.signal.aborted) {
        throw Object.assign(
          new Error("에브리타임 시간표 요청 시간이 초과되었습니다."),
          { cause: error },
        );
      }
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const parseSemesterMetadataList = (
    documentRoot: Document,
  ): Map<string, EverytimeSemesterMetadata> => {
    const metadataBySemester = new Map<string, EverytimeSemesterMetadata>();

    documentRoot.querySelectorAll("response > semester").forEach((semester) => {
      const year = parseOptionalNumber(readAttribute(semester, "year"));
      const term = readAttribute(semester, "semester");
      if (
        year === undefined ||
        !Number.isInteger(year) ||
        !isEverytimeSemesterTerm(term)
      ) {
        return;
      }

      const metadata: EverytimeSemesterMetadata = {
        year,
        term,
        startDate: readAttribute(semester, "start_date"),
        endDate: readAttribute(semester, "end_date"),
        isFormal: parseOptionalFlag(readAttribute(semester, "is_formal")),
        isSupported: parseOptionalFlag(readAttribute(semester, "is_supported")),
        hasSyllabus: parseOptionalFlag(readAttribute(semester, "has_syllabus")),
        hasSubjectDatabase: parseOptionalFlag(
          readAttribute(semester, "has_subject_database"),
        ),
        subjectDatabaseUpdatedAt: readAttribute(semester, "updated_at"),
      };
      metadataBySemester.set(formatEverytimeSemester(year, term), metadata);
    });

    return metadataBySemester;
  };

  const getSemesterMetadataByLabel = async (): Promise<
    Map<string, EverytimeSemesterMetadata>
  > => {
    if (
      semesterMetadataCache &&
      semesterMetadataCache.expiresAt > Date.now()
    ) {
      return semesterMetadataCache.value;
    }

    const documentRoot = await fetchEverytimeXml(
      EVERYTIME_SEMESTER_LIST_URL,
      new URLSearchParams(),
    );
    const value = parseSemesterMetadataList(documentRoot);
    semesterMetadataCache = {
      expiresAt: Date.now() + SEMESTER_METADATA_CACHE_TTL_MS,
      value,
    };
    return value;
  };

  // The rendered <select> is the source of truth because it reflects what
  // Everytime offers on the timetable page. When it never appears — a slow
  // render past the wait, or a markup change on their side — the semester API
  // still answers, and a superset ordered newest-first costs nothing because
  // the caller stops at the first batch that has timetables.
  const listSemesterLabels = async (): Promise<string[]> => {
    const rendered = await waitForSemesterOptions();
    if (rendered.length > 0) {
      return rendered;
    }

    const metadata = await getSemesterMetadataByLabel();
    return Array.from(metadata.keys()).filter((label) =>
      EVERYTIME_SEMESTER_PATTERN.test(label),
    );
  };

  const parseTableMetadata = (
    table: Element,
    fallback: EverytimeTableMetadata = {},
  ): EverytimeTableMetadata => {
    const term = readAttribute(table, "semester");
    const parsedTerm = isEverytimeSemesterTerm(term) ? term : fallback.term;

    return {
      id: readAttribute(table, "id") ?? fallback.id,
      name: readAttribute(table, "name") ?? fallback.name,
      year: parseOptionalNumber(readAttribute(table, "year")) ?? fallback.year,
      term: parsedTerm,
      isDeleted:
        parseOptionalFlag(readAttribute(table, "is_deleted")) ??
        fallback.isDeleted,
      isPrivate:
        parseOptionalFlag(readAttribute(table, "priv")) ?? fallback.isPrivate,
      isPrimary:
        parseOptionalFlag(readAttribute(table, "primary", "is_primary")) ??
        fallback.isPrimary,
      createdAt: readAttribute(table, "created_at") ?? fallback.createdAt,
      updatedAt: readAttribute(table, "updated_at") ?? fallback.updatedAt,
    };
  };

  const parseApiTimetable = (
    documentRoot: Document,
    semester: string,
    semesterMetadata?: EverytimeSemesterMetadata,
    listTableMetadata?: EverytimeTableMetadata,
  ): EverytimeTimetable | null => {
    const table = documentRoot.querySelector("response > table");
    if (!table) {
      return null;
    }

    const courses = Array.from(
      table.querySelectorAll(":scope > subject"),
    ).flatMap((subject, subjectIndex): EverytimeCourse[] => {
      const title = readValue(subject, "name");
      if (!title) {
        return [];
      }

      const subjectId = readAttribute(subject, "id");
      const internalId = readValue(subject, "internal");
      const professor = readValue(subject, "professor") ?? "";
      const defaultPlace = readValue(subject, "place") ?? "";
      const timeText = readValue(subject, "time");
      const credit = parseOptionalNumber(readValue(subject, "credit"));
      const isClosed = parseOptionalFlag(readValue(subject, "closed"));
      const meetings = Array.from(subject.querySelectorAll("time > data")).flatMap(
        (time) => {
          const dayIndex = Number.parseInt(time.getAttribute("day") ?? "", 10);
          const startTime = Number.parseInt(
            time.getAttribute("starttime") ?? "",
            10,
          );
          const endTime = Number.parseInt(
            time.getAttribute("endtime") ?? "",
            10,
          );
          if (
            !Number.isInteger(dayIndex) ||
            dayIndex < 0 ||
            dayIndex >= EVERYTIME_WEEKDAYS.length ||
            !Number.isFinite(startTime) ||
            !Number.isFinite(endTime) ||
            endTime <= startTime
          ) {
            return [];
          }

          const place = time.getAttribute("place")?.trim() || defaultPlace;
          return [
            {
              dayIndex,
              place: place || undefined,
              startTime,
              endTime,
            },
          ];
        },
      );

      return [
        {
          id: subjectId ?? `${semester}:course:${subjectIndex}`,
          internalId,
          title,
          professor: professor || undefined,
          timeText,
          defaultPlace: defaultPlace || undefined,
          credit,
          isClosed,
          meetings,
        },
      ];
    });
    const subjects = courses.flatMap((course) =>
      course.meetings.map((meeting, timeIndex): EverytimeSubject => ({
        id: `${semester}:${course.id}:${timeIndex}`,
        subjectId: course.id,
        internalId: course.internalId,
        dayIndex: meeting.dayIndex,
        title: course.title,
        professor: course.professor,
        place: meeting.place,
        defaultPlace: course.defaultPlace,
        timeText: course.timeText,
        credit: course.credit,
        isClosed: course.isClosed,
        startTime: meeting.startTime,
        endTime: meeting.endTime,
        detail:
          [course.professor, meeting.place].filter(Boolean).join(" · ") ||
          undefined,
        color: getStableEverytimeSubjectColor(course.id),
        top: meeting.startTime * EVERYTIME_TIME_UNIT_PX,
        height:
          (meeting.endTime - meeting.startTime) * EVERYTIME_TIME_UNIT_PX,
      })),
    );

    return {
      semester,
      semesterMetadata,
      tableMetadata: parseTableMetadata(table, listTableMetadata),
      courses,
      weekdays: EVERYTIME_WEEKDAYS,
      slotCount: 48,
      subjects,
    };
  };

  const fetchSemesterFromApi = async (
    semester: string,
    semesterMetadata?: EverytimeSemesterMetadata,
  ): Promise<EverytimeTimetable | null> => {
    const period = parseEverytimeSemester(semester);
    if (!period) {
      return null;
    }

    const listDocument = await fetchEverytimeXml(
      EVERYTIME_TABLE_LIST_URL,
      new URLSearchParams({
        year: String(period.year),
        semester: period.term,
      }),
    );
    const tables = Array.from(listDocument.querySelectorAll("response > table"));
    const selectedTable =
      tables.find((table) =>
        isPrimaryEverytimeTable(
          table.getAttribute("primary"),
          table.getAttribute("is_primary"),
        ),
      ) ??
      tables[0];
    if (!selectedTable) {
      return null;
    }

    const tableId = selectedTable.getAttribute("id");
    if (!tableId) {
      return null;
    }
    const listTableMetadata = parseTableMetadata(selectedTable);

    const detailDocument = await fetchEverytimeXml(
      EVERYTIME_TABLE_DETAIL_URL,
      new URLSearchParams({ id: tableId }),
    );
    return parseApiTimetable(
      detailDocument,
      semester,
      semesterMetadata,
      listTableMetadata,
    );
  };

  const fetchSemestersFromApi = async (
    semesters: string[],
  ): Promise<CaptureResponse> => {
    const requestedSemesters = [...new Set(semesters)].filter(
      (semester) => parseEverytimeSemester(semester) !== null,
    );
    const results: Array<EverytimeTimetable | null> = new Array(
      requestedSemesters.length,
    ).fill(null);
    let nextIndex = 0;

    try {
      const semesterMetadataByLabel = await getSemesterMetadataByLabel();
      const workers = Array.from(
        {
          length: Math.min(
            SEMESTER_FETCH_CONCURRENCY,
            requestedSemesters.length,
          ),
        },
        async () => {
          while (nextIndex < requestedSemesters.length) {
            const currentIndex = nextIndex;
            nextIndex += 1;
            const requestedSemester = requestedSemesters[currentIndex];
            results[currentIndex] = await fetchSemesterFromApi(
              requestedSemester,
              semesterMetadataByLabel.get(requestedSemester),
            );
          }
        },
      );
      await Promise.all(workers);
    } catch (error) {
      reportContentException(error, "everytime_fetch_semesters");
      return {
        success: false,
        error: "에브리타임 시간표 API를 불러오지 못했습니다.",
      };
    }

    const timetables = results.filter(
      (timetable): timetable is EverytimeTimetable =>
        timetable != null &&
        (timetable.subjects.length > 0 || (timetable.courses?.length ?? 0) > 0),
    );
    const loadedSemesters = new Set(
      timetables.map((timetable) => timetable.semester),
    );
    return {
      success: true,
      timetables,
      skippedSemesters: requestedSemesters.filter(
        (semester) => !loadedSemesters.has(semester),
      ),
    };
  };

  chrome.runtime.onMessage.addListener(
    (
      message: unknown,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response: CaptureResponse) => void,
    ) => {
      const messageType = getRuntimeMessageType(message);
      const respond = createRuntimeMessageResponder({
        runtime: "content",
        messageType,
        sendResponse,
      });

      try {
        recordBreadcrumb("content.message", "message received", {
          message_type: messageType,
        });

        if (!isCaptureRequest(message)) {
          respond({
            success: false,
            error: "Invalid Everytime capture message.",
          });
          return false;
        }

        if (message.type === "LINKU_EVERYTIME_CAPTURE_PING") {
          respond({ success: true, ready: true });
          return false;
        }

        if (message.type === "LINKU_EVERYTIME_LIST_SEMESTERS") {
          listSemesterLabels()
            .then((semesters) =>
              respond({
                success: true,
                semesters,
                currentSemester: readSemester(),
              }),
            )
            .catch((error: unknown) => {
              reportContentException(error, "everytime_list_semesters");
              respond({
                success: false,
                error: "에브리타임 학기 목록을 읽지 못했습니다.",
              });
            });
          return true;
        }

        if (message.type === "LINKU_EVERYTIME_CAPTURE_CURRENT") {
          waitForRenderedTimetable(message.data.semester)
            .then((timetable) => respond({ success: true, timetable }))
            .catch((error: unknown) => {
              reportContentException(error, "everytime_capture_current");
              respond({
                success: false,
                error: "에브리타임 시간표를 읽지 못했습니다.",
              });
            });
          return true;
        }

        if (message.type === "LINKU_EVERYTIME_FETCH_SEMESTERS") {
          fetchSemestersFromApi(message.data.semesters)
            .then(respond)
            .catch((error: unknown) => {
              reportContentException(error, "everytime_fetch_semesters");
              respond({
                success: false,
                error: "에브리타임 시간표 API를 불러오지 못했습니다.",
              });
            });
          return true;
        }

        respond({
          success: false,
          error: "Unsupported Everytime capture message.",
        });
        return false;
      } catch (error) {
        reportContentException(error, "message_handler");
        respond({
          success: false,
          error: "에브리타임 요청을 처리하지 못했습니다.",
        });
        return false;
      }
    },
  );
}
