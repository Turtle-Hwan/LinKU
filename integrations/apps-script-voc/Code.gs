const VOC_CONFIG = Object.freeze({
  spreadsheetIdProperty: "VOC_SPREADSHEET_ID",
  recipientEmailProperty: "VOC_RECIPIENT_EMAIL",
  sheetNameProperty: "VOC_SHEET_NAME",
  defaultSheetName: "Feedback",
  spreadsheetName: "LinKU VoC",
  digestFunctionName: "sendDailyDigest",
  lastDigestDateProperty: "VOC_LAST_DIGEST_DATE",
  intakeDateProperty: "VOC_INTAKE_DATE",
  intakeCountProperty: "VOC_INTAKE_COUNT",
  digestHour: 9,
  digestTimezone: "Asia/Seoul",
  maxDigestBodyBytes: 180 * 1024,
  maxRequestsPerMinute: 30,
  maxSubmissionsPerDay: 500,
  rateLimitCacheKey: "voc-global-rate-limit",
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
  "contact_email",
]);

const LEGACY_VOC_HEADERS = Object.freeze(VOC_HEADERS.slice(0, -1));

const VOC_CATEGORY_LABELS = Object.freeze({
  feature: "기능 제안",
  bug: "오류 제보",
  experience: "사용 경험",
  other: "의견",
});

/**
 * Apps Script 편집기에서 최초 1회 직접 실행합니다.
 * 전용 Spreadsheet와 일일 다이제스트 트리거를 만들고 Script Properties에 저장합니다.
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
  installDailyDigestTrigger_();

  // 최초 실행 시 메일 권한도 함께 승인받습니다.
  const remainingMailQuota = MailApp.getRemainingDailyQuota();
  return {
    spreadsheetUrl: spreadsheet.getUrl(),
    sheetName: sheet.getName(),
    recipientEmail: recipientEmail,
    remainingMailQuota: remainingMailQuota,
    dailyDigestHour: VOC_CONFIG.digestHour,
    dailyDigestTimezone: VOC_CONFIG.digestTimezone,
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
    if (duplicate) {
      const contactEmailStored = ensureContactEmail_(
        sheet,
        existingRow,
        submission.contactEmail,
      );
      SpreadsheetApp.flush();
      return jsonResponse_({
        success: true,
        persisted: true,
        duplicate: true,
        contactEmailStored: contactEmailStored,
      });
    }

    enforceIntakeBudget_();
    appendSubmission_(sheet, submission);

    // Sheet 반영만 즉시 확정하고, 메일은 일일 다이제스트가 별도로 처리합니다.
    SpreadsheetApp.flush();

    return jsonResponse_({
      success: true,
      persisted: true,
      duplicate: false,
      contactEmailStored: true,
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
 * 아직 메일로 보고되지 않은 VoC를 매일 한 통의 다이제스트로 발송합니다.
 * initialize()가 매일 오전 9시(KST) 전후의 시간 기반 트리거를 등록합니다.
 */
function sendDailyDigest() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return { sent: false, reason: "BUSY" };
  }

  try {
    const properties = PropertiesService.getScriptProperties();
    const digestDate = Utilities.formatDate(
      new Date(),
      VOC_CONFIG.digestTimezone,
      "yyyy-MM-dd",
    );
    if (
      properties.getProperty(VOC_CONFIG.lastDigestDateProperty) === digestDate
    ) {
      return { sent: false, reason: "ALREADY_SENT_TODAY" };
    }

    const spreadsheet = getConfiguredSpreadsheet_();
    const sheet = getOrCreateFeedbackSheet_(spreadsheet);
    const pending = getPendingNotifications_(sheet);
    if (pending.length === 0) {
      return { sent: false, reason: "NO_PENDING_FEEDBACK" };
    }

    const recipientEmail = properties.getProperty(
      VOC_CONFIG.recipientEmailProperty,
    );
    if (!recipientEmail) {
      updateNotificationFailures_(
        sheet,
        pending,
        "VOC_RECIPIENT_EMAIL is not configured",
      );
      return { sent: false, reason: "RECIPIENT_NOT_CONFIGURED" };
    }

    if (MailApp.getRemainingDailyQuota() < 1) {
      updateNotificationFailures_(sheet, pending, "Mail quota exhausted");
      return { sent: false, reason: "MAIL_QUOTA_EXHAUSTED" };
    }

    const digest = buildDailyDigest_(
      pending,
      digestDate,
      spreadsheet.getUrl(),
    );

    try {
      MailApp.sendEmail({
        to: recipientEmail,
        subject:
          "[LinKU VoC] " + digestDate + " 의견 " + digest.items.length + "건",
        body: digest.body,
        name: "LinKU VoC",
      });

      for (const item of digest.items) {
        setNotificationState_(
          sheet,
          item.rowNumber,
          true,
          item.submission.notificationAttempts + 1,
          "",
        );
      }
      properties.setProperty(VOC_CONFIG.lastDigestDateProperty, digestDate);
      SpreadsheetApp.flush();
      return {
        sent: true,
        includedCount: digest.items.length,
        deferredCount: pending.length - digest.items.length,
      };
    } catch (error) {
      updateNotificationFailures_(
        sheet,
        digest.items,
        getPrivateErrorMessage_(error),
      );
      return { sent: false, reason: "MAIL_SEND_FAILED" };
    }
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
  const category = normalizeText_(payload.category);
  const title = normalizeText_(payload.title).trim();
  const message = normalizeText_(payload.message).trim();
  const contactEmail = normalizeText_(payload.contactEmail).trim().toLowerCase();
  const extensionVersion = normalizeText_(payload.extensionVersion).trim();
  const createdAt = normalizeText_(payload.createdAt).trim();
  const website = normalizeText_(payload.website).trim();

  const valid =
    /^[A-Za-z0-9-]{20,64}$/.test(submissionId) &&
    Object.prototype.hasOwnProperty.call(VOC_CATEGORY_LABELS, category) &&
    title.length >= 1 &&
    title.length <= 80 &&
    message.length >= 1 &&
    message.length <= 500 &&
    (contactEmail === "" || isValidContactEmail_(contactEmail)) &&
    extensionVersion.length >= 1 &&
    extensionVersion.length <= 32 &&
    !Number.isNaN(Date.parse(createdAt)) &&
    website === "";

  if (!valid) throw new Error("INVALID_PAYLOAD");

  return {
    submissionId: submissionId,
    category: category,
    title: title,
    message: message,
    contactEmail: contactEmail,
    extensionVersion: extensionVersion,
    createdAt: createdAt,
  };
}

function isValidContactEmail_(email) {
  return (
    email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
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
      const existingLegacyHeaders = existingHeaders.slice(
        0,
        LEGACY_VOC_HEADERS.length,
      );
      const contactEmailHeader = existingHeaders[LEGACY_VOC_HEADERS.length];
      if (
        existingLegacyHeaders.join("\u0000") ===
          LEGACY_VOC_HEADERS.join("\u0000") &&
        contactEmailHeader === ""
      ) {
        sheet
          .getRange(1, VOC_HEADERS.length)
          .setValue(VOC_HEADERS[VOC_HEADERS.length - 1]);
      } else {
        throw new Error("INVALID_SHEET_SCHEMA");
      }
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

function ensureContactEmail_(sheet, rowNumber, contactEmail) {
  if (!contactEmail) return true;

  const emailColumn = VOC_HEADERS.indexOf("contact_email") + 1;
  const storedEmail = String(
    sheet.getRange(rowNumber, emailColumn).getDisplayValue(),
  )
    .trim()
    .toLowerCase();
  if (storedEmail === contactEmail) return true;
  if (storedEmail !== "") return false;

  sheet.getRange(rowNumber, emailColumn).setValue(safeSheetText_(contactEmail));
  const notificationSentColumn = VOC_HEADERS.indexOf("notification_sent") + 1;
  if (sheet.getRange(rowNumber, notificationSentColumn).getValue() === true) {
    // 이전 수집기가 이메일 없이 이미 보고한 건도 답장 주소와 함께 한 번 더 알립니다.
    sheet.getRange(rowNumber, notificationSentColumn).setValue(false);
  }
  return true;
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
    safeSheetText_(submission.contactEmail),
  ]);
  return sheet.getLastRow();
}

function readSubmission_(sheet, rowNumber) {
  const row = sheet
    .getRange(rowNumber, 1, 1, VOC_HEADERS.length)
    .getValues()[0];
  return {
    submissionId: String(row[0]),
    receivedAt: row[1],
    createdAt: row[2],
    category: String(row[3]),
    title: String(row[4]),
    message: String(row[5]),
    contactEmail: String(row[10] || ""),
    extensionVersion: String(row[6]),
    notificationSent: row[7] === true,
    notificationAttempts: Number(row[8]) || 0,
  };
}

function getPendingNotifications_(sheet) {
  const pending = [];
  for (let rowNumber = 2; rowNumber <= sheet.getLastRow(); rowNumber += 1) {
    const submission = readSubmission_(sheet, rowNumber);
    if (!submission.notificationSent) {
      pending.push({ rowNumber: rowNumber, submission: submission });
    }
  }
  return pending;
}

function buildDailyDigest_(pending, digestDate, spreadsheetUrl) {
  const header = [
    digestDate + " LinKU VoC 다이제스트",
    "",
    "메일로 보고되지 않은 의견 " + pending.length + "건을 모았습니다.",
  ];
  const sections = [];
  const includedItems = [];

  for (const item of pending) {
    const submission = item.submission;
    const categoryLabel =
      VOC_CATEGORY_LABELS[submission.category] || VOC_CATEGORY_LABELS.other;
    const receivedAt = Utilities.formatDate(
      new Date(submission.receivedAt),
      VOC_CONFIG.digestTimezone,
      "yyyy-MM-dd HH:mm",
    );
    const sectionLines = [
      includedItems.length +
        1 +
        ". [" +
        categoryLabel +
        "] " +
        submission.title,
      "접수: " + receivedAt,
      "내용: " + submission.message,
    ];
    if (submission.contactEmail) {
      sectionLines.push("답장 이메일: " + submission.contactEmail);
    }
    sectionLines.push(
      "확장 프로그램 버전: " + submission.extensionVersion,
      "제출 ID: " + submission.submissionId,
    );
    const section = sectionLines.join("\n");
    const candidateBody = header
      .concat([
        "",
        sections.concat([section]).join("\n\n"),
        "",
        "Sheet: " + spreadsheetUrl,
      ])
      .join("\n");

    if (getUtf8ByteLength_(candidateBody) > VOC_CONFIG.maxDigestBodyBytes) {
      break;
    }
    sections.push(section);
    includedItems.push(item);
  }

  const deferredCount = pending.length - includedItems.length;
  const footer = [
    "",
    deferredCount > 0
      ? "메일 크기 제한으로 나머지 " +
        deferredCount +
        "건은 Sheet에서 확인하거나 다음 다이제스트에서 받을 수 있습니다."
      : "모든 미보고 의견을 포함했습니다.",
    "Sheet: " + spreadsheetUrl,
  ];

  return {
    body: header.concat(["", sections.join("\n\n")], footer).join("\n"),
    items: includedItems,
  };
}

function getUtf8ByteLength_(text) {
  return Utilities.newBlob(text).getBytes().length;
}

function updateNotificationFailures_(sheet, items, error) {
  for (const item of items) {
    setNotificationState_(
      sheet,
      item.rowNumber,
      false,
      item.submission.notificationAttempts + 1,
      error,
    );
  }
  SpreadsheetApp.flush();
}

function setNotificationState_(sheet, rowNumber, sent, attempts, error) {
  sheet
    .getRange(rowNumber, 8, 1, 3)
    .setValues([[sent, attempts, safeSheetText_(error).slice(0, 200)]]);
}

function installDailyDigestTrigger_() {
  for (const trigger of ScriptApp.getProjectTriggers()) {
    if (
      trigger.getEventType() === ScriptApp.EventType.CLOCK &&
      trigger.getHandlerFunction() === VOC_CONFIG.digestFunctionName
    ) {
      ScriptApp.deleteTrigger(trigger);
    }
  }

  ScriptApp.newTrigger(VOC_CONFIG.digestFunctionName)
    .timeBased()
    .atHour(VOC_CONFIG.digestHour)
    .nearMinute(0)
    .everyDays(1)
    .inTimezone(VOC_CONFIG.digestTimezone)
    .create();
}

function enforceIntakeBudget_() {
  const cache = CacheService.getScriptCache();
  const requestCount = Number(
    cache.get(VOC_CONFIG.rateLimitCacheKey) || 0,
  );

  if (requestCount >= VOC_CONFIG.maxRequestsPerMinute) {
    throw new Error("RATE_LIMITED");
  }
  cache.put(
    VOC_CONFIG.rateLimitCacheKey,
    String(requestCount + 1),
    60,
  );

  const properties = PropertiesService.getScriptProperties();
  const intakeDate = Utilities.formatDate(
    new Date(),
    VOC_CONFIG.digestTimezone,
    "yyyy-MM-dd",
  );
  const storedDate = properties.getProperty(VOC_CONFIG.intakeDateProperty);
  const intakeCount =
    storedDate === intakeDate
      ? Number(properties.getProperty(VOC_CONFIG.intakeCountProperty) || 0)
      : 0;

  if (intakeCount >= VOC_CONFIG.maxSubmissionsPerDay) {
    throw new Error("RATE_LIMITED");
  }

  properties.setProperties({
    [VOC_CONFIG.intakeDateProperty]: intakeDate,
    [VOC_CONFIG.intakeCountProperty]: String(intakeCount + 1),
  });
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
    "BUSY",
  ];
  return publicCodes.includes(message) ? message : "SERVICE_UNAVAILABLE";
}

function jsonResponse_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
