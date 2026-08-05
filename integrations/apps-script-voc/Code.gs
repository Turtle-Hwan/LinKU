const VOC_CONFIG = Object.freeze({
  spreadsheetIdProperty: "VOC_SPREADSHEET_ID",
  recipientEmailProperty: "VOC_RECIPIENT_EMAIL",
  sheetNameProperty: "VOC_SHEET_NAME",
  defaultSheetName: "Feedback",
  spreadsheetName: "LinKU VoC",
  retryFunctionName: "retryPendingNotifications",
  maxNotificationsPerRetry: 20,
  maxRequestsPerMinute: 10,
});

const VOC_HEADERS = Object.freeze([
  "submission_id",
  "received_at",
  "created_at",
  "category",
  "title",
  "message",
  "extension_version",
  "notification_sent",
  "notification_attempts",
  "last_notification_error",
]);

const VOC_CATEGORY_LABELS = Object.freeze({
  feature: "기능 제안",
  bug: "오류 제보",
  experience: "사용 경험",
  other: "기타 의견",
});

/**
 * Apps Script 편집기에서 최초 1회 직접 실행합니다.
 * 전용 Spreadsheet와 메일 재시도 트리거를 만들고 Script Properties에 저장합니다.
 */
function initialize() {
  const properties = PropertiesService.getScriptProperties();
  let spreadsheetId = properties.getProperty(
    VOC_CONFIG.spreadsheetIdProperty,
  );
  let spreadsheet;

  if (spreadsheetId) {
    spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  } else {
    spreadsheet = SpreadsheetApp.create(VOC_CONFIG.spreadsheetName);
    spreadsheetId = spreadsheet.getId();
    properties.setProperty(
      VOC_CONFIG.spreadsheetIdProperty,
      spreadsheetId,
    );
  }

  let recipientEmail = properties.getProperty(
    VOC_CONFIG.recipientEmailProperty,
  );
  if (!recipientEmail) {
    recipientEmail = Session.getEffectiveUser().getEmail();
    if (!recipientEmail) {
      throw new Error(
        "프로젝트 설정의 Script Properties에 VOC_RECIPIENT_EMAIL을 추가하세요.",
      );
    }
    properties.setProperty(
      VOC_CONFIG.recipientEmailProperty,
      recipientEmail,
    );
  }

  const sheet = getOrCreateFeedbackSheet_(spreadsheet);
  installRetryTrigger_();

  // 최초 실행 시 메일 권한도 함께 승인받습니다.
  const remainingMailQuota = MailApp.getRemainingDailyQuota();
  return {
    spreadsheetUrl: spreadsheet.getUrl(),
    sheetName: sheet.getName(),
    recipientEmail: recipientEmail,
    remainingMailQuota: remainingMailQuota,
  };
}

function doGet() {
  return jsonResponse_({
    success: true,
    service: "linku-voc",
  });
}

function doPost(event) {
  let lock;

  try {
    const submission = parseSubmission_(event);
    enforceRateLimit_(submission.clientId);

    lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) {
      return jsonResponse_({
        success: false,
        persisted: false,
        retryable: true,
        error: "BUSY",
      });
    }

    const spreadsheet = getConfiguredSpreadsheet_();
    const sheet = getOrCreateFeedbackSheet_(spreadsheet);
    const existingRow = findSubmissionRow_(sheet, submission.submissionId);
    const duplicate = existingRow !== null;
    const rowNumber = duplicate
      ? existingRow
      : appendSubmission_(sheet, submission);

    // Sheet 반영을 먼저 확정한 뒤 알림을 시도합니다.
    SpreadsheetApp.flush();
    const storedSubmission = readSubmission_(sheet, rowNumber);
    const notificationSent = attemptNotification_(
      sheet,
      rowNumber,
      storedSubmission,
      spreadsheet.getUrl(),
    );
    SpreadsheetApp.flush();

    return jsonResponse_({
      success: true,
      persisted: true,
      duplicate: duplicate,
      notificationSent: notificationSent,
    });
  } catch (error) {
    const errorCode = getErrorCode_(error);
    return jsonResponse_({
      success: false,
      persisted: false,
      retryable: errorCode !== "INVALID_PAYLOAD",
      error: errorCode,
    });
  } finally {
    if (lock && lock.hasLock()) {
      lock.releaseLock();
    }
  }
}

/**
 * 메일 할당량 또는 일시 오류로 알림을 못 보낸 행을 다시 처리합니다.
 * initialize()가 6시간 간격의 시간 기반 트리거를 자동으로 등록합니다.
 */
function retryPendingNotifications() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return;

  try {
    const spreadsheet = getConfiguredSpreadsheet_();
    const sheet = getOrCreateFeedbackSheet_(spreadsheet);
    const lastRow = sheet.getLastRow();
    let attempted = 0;

    for (let rowNumber = 2; rowNumber <= lastRow; rowNumber += 1) {
      const notificationSent = sheet.getRange(rowNumber, 8).getValue() === true;
      if (notificationSent) continue;
      if (MailApp.getRemainingDailyQuota() < 1) break;
      if (attempted >= VOC_CONFIG.maxNotificationsPerRetry) break;

      try {
        const submission = readSubmission_(sheet, rowNumber);
        attemptNotification_(
          sheet,
          rowNumber,
          submission,
          spreadsheet.getUrl(),
        );
      } catch (error) {
        setNotificationState_(
          sheet,
          rowNumber,
          false,
          Number(sheet.getRange(rowNumber, 9).getValue() || 0) + 1,
          getPrivateErrorMessage_(error),
        );
      }
      attempted += 1;
    }

    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
}

function parseSubmission_(event) {
  const contents =
    event && event.postData && typeof event.postData.contents === "string"
      ? event.postData.contents
      : "";

  if (!contents || contents.length > 5000) {
    throw new Error("INVALID_PAYLOAD");
  }

  let payload;
  try {
    payload = JSON.parse(contents);
  } catch (_error) {
    throw new Error("INVALID_PAYLOAD");
  }

  const submissionId = normalizeText_(payload.submissionId);
  const clientId = normalizeText_(payload.clientId);
  const category = normalizeText_(payload.category);
  const title = normalizeText_(payload.title).trim();
  const message = normalizeText_(payload.message).trim();
  const extensionVersion = normalizeText_(payload.extensionVersion).trim();
  const createdAt = normalizeText_(payload.createdAt).trim();
  const website = normalizeText_(payload.website).trim();

  const valid =
    /^[A-Za-z0-9-]{20,64}$/.test(submissionId) &&
    clientId.length >= 8 &&
    clientId.length <= 128 &&
    Object.prototype.hasOwnProperty.call(VOC_CATEGORY_LABELS, category) &&
    title.length >= 2 &&
    title.length <= 80 &&
    message.length >= 10 &&
    message.length <= 500 &&
    extensionVersion.length >= 1 &&
    extensionVersion.length <= 32 &&
    !Number.isNaN(Date.parse(createdAt)) &&
    website === "";

  if (!valid) throw new Error("INVALID_PAYLOAD");

  return {
    submissionId: submissionId,
    clientId: clientId,
    category: category,
    title: title,
    message: message,
    extensionVersion: extensionVersion,
    createdAt: createdAt,
  };
}

function getConfiguredSpreadsheet_() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty(
    VOC_CONFIG.spreadsheetIdProperty,
  );
  if (!spreadsheetId) throw new Error("NOT_CONFIGURED");
  return SpreadsheetApp.openById(spreadsheetId);
}

function getOrCreateFeedbackSheet_(spreadsheet) {
  const properties = PropertiesService.getScriptProperties();
  const sheetName =
    properties.getProperty(VOC_CONFIG.sheetNameProperty) ||
    VOC_CONFIG.defaultSheetName;
  let sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, VOC_HEADERS.length).setValues([VOC_HEADERS]);
    sheet.setFrozenRows(1);
  } else {
    const existingHeaders = sheet
      .getRange(1, 1, 1, VOC_HEADERS.length)
      .getDisplayValues()[0];
    if (existingHeaders.join("\u0000") !== VOC_HEADERS.join("\u0000")) {
      throw new Error("INVALID_SHEET_SCHEMA");
    }
  }

  return sheet;
}

function findSubmissionRow_(sheet, submissionId) {
  if (sheet.getLastRow() < 2) return null;

  const match = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, 1)
    .createTextFinder(submissionId)
    .matchEntireCell(true)
    .findNext();
  return match ? match.getRow() : null;
}

function appendSubmission_(sheet, submission) {
  sheet.appendRow([
    safeSheetText_(submission.submissionId),
    new Date(),
    new Date(submission.createdAt),
    safeSheetText_(submission.category),
    safeSheetText_(submission.title),
    safeSheetText_(submission.message),
    safeSheetText_(submission.extensionVersion),
    false,
    0,
    "",
  ]);
  return sheet.getLastRow();
}

function readSubmission_(sheet, rowNumber) {
  const row = sheet.getRange(rowNumber, 1, 1, 10).getValues()[0];
  return {
    submissionId: String(row[0]),
    receivedAt: row[1],
    createdAt: row[2],
    category: String(row[3]),
    title: String(row[4]),
    message: String(row[5]),
    extensionVersion: String(row[6]),
    notificationSent: row[7] === true,
    notificationAttempts: Number(row[8]) || 0,
  };
}

function attemptNotification_(
  sheet,
  rowNumber,
  submission,
  spreadsheetUrl,
) {
  if (submission.notificationSent) return true;

  const attempts = submission.notificationAttempts + 1;
  try {
    const recipientEmail = PropertiesService.getScriptProperties().getProperty(
      VOC_CONFIG.recipientEmailProperty,
    );

    if (!recipientEmail) {
      setNotificationState_(
        sheet,
        rowNumber,
        false,
        attempts,
        "VOC_RECIPIENT_EMAIL is not configured",
      );
      return false;
    }

    if (MailApp.getRemainingDailyQuota() < 1) {
      setNotificationState_(
        sheet,
        rowNumber,
        false,
        attempts,
        "Mail quota exhausted",
      );
      return false;
    }

    const categoryLabel =
      VOC_CATEGORY_LABELS[submission.category] || VOC_CATEGORY_LABELS.other;
    const subjectTitle = submission.title.replace(/[\r\n]+/g, " ");
    const body = [
      "LinKU에 새로운 의견이 도착했습니다.",
      "",
      "유형: " + categoryLabel,
      "제목: " + submission.title,
      "내용:",
      submission.message,
      "",
      "확장 프로그램 버전: " + submission.extensionVersion,
      "제출 ID: " + submission.submissionId,
      "Sheet: " + spreadsheetUrl,
    ].join("\n");

    MailApp.sendEmail({
      to: recipientEmail,
      subject: "[LinKU VoC/" + categoryLabel + "] " + subjectTitle,
      body: body,
      name: "LinKU VoC",
    });
    setNotificationState_(sheet, rowNumber, true, attempts, "");
    return true;
  } catch (error) {
    try {
      setNotificationState_(
        sheet,
        rowNumber,
        false,
        attempts,
        getPrivateErrorMessage_(error),
      );
    } catch (_stateError) {
      // Sheet 본문은 이미 저장됐으므로 알림 상태 기록 실패도 제출 실패로 바꾸지 않습니다.
    }
    return false;
  }
}

function setNotificationState_(sheet, rowNumber, sent, attempts, error) {
  sheet
    .getRange(rowNumber, 8, 1, 3)
    .setValues([[sent, attempts, safeSheetText_(error).slice(0, 200)]]);
}

function installRetryTrigger_() {
  const alreadyInstalled = ScriptApp.getProjectTriggers().some(
    (trigger) =>
      trigger.getHandlerFunction() === VOC_CONFIG.retryFunctionName &&
      trigger.getEventType() === ScriptApp.EventType.CLOCK,
  );
  if (alreadyInstalled) return;

  ScriptApp.newTrigger(VOC_CONFIG.retryFunctionName)
    .timeBased()
    .everyHours(6)
    .create();
}

function enforceRateLimit_(clientId) {
  const cache = CacheService.getScriptCache();
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    clientId,
  )
    .slice(0, 12)
    .map((value) => (value + 256).toString(16).slice(-2))
    .join("");
  const key = "voc-rate-" + digest;
  const requestCount = Number(cache.get(key) || 0);

  if (requestCount >= VOC_CONFIG.maxRequestsPerMinute) {
    throw new Error("RATE_LIMITED");
  }
  cache.put(key, String(requestCount + 1), 60);
}

function normalizeText_(value) {
  return typeof value === "string" ? value : "";
}

function safeSheetText_(value) {
  const text = String(value == null ? "" : value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function getPrivateErrorMessage_(error) {
  return error && error.message ? String(error.message) : String(error);
}

function getErrorCode_(error) {
  const message = getPrivateErrorMessage_(error);
  const publicCodes = [
    "INVALID_PAYLOAD",
    "RATE_LIMITED",
    "NOT_CONFIGURED",
    "INVALID_SHEET_SCHEMA",
  ];
  return publicCodes.includes(message) ? message : "INTERNAL_ERROR";
}

function jsonResponse_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
