import assert from "node:assert/strict";
import test from "node:test";
import {
  detectImageMimeType,
  TIMETABLE_IMAGE_REQUIREMENTS,
} from "../../src/components/Tabs/TimeTable/timetableImage.ts";

test("파일 확장자가 아닌 이미지 시그니처로 형식을 판별한다", () => {
  assert.equal(
    detectImageMimeType(Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])),
    "image/png",
  );
  assert.equal(
    detectImageMimeType(Uint8Array.from([255, 216, 255, 224])),
    "image/jpeg",
  );
  assert.equal(
    detectImageMimeType(
      Uint8Array.from([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]),
    ),
    "image/webp",
  );
  assert.equal(
    detectImageMimeType(
      Uint8Array.from([0, 0, 0, 24, 102, 116, 121, 112, 97, 118, 105, 102]),
    ),
    "image/avif",
  );
  assert.equal(detectImageMimeType(Uint8Array.from([1, 2, 3, 4])), null);
});

test("압축 크기와 디코딩 해상도 제한을 함께 둔다", () => {
  assert.equal(TIMETABLE_IMAGE_REQUIREMENTS.maxByteSize, 5 * 1024 * 1024);
  assert.equal(TIMETABLE_IMAGE_REQUIREMENTS.maxWidth, 8_192);
  assert.equal(TIMETABLE_IMAGE_REQUIREMENTS.maxHeight, 8_192);
  assert.equal(TIMETABLE_IMAGE_REQUIREMENTS.maxPixelCount, 32_000_000);
});
