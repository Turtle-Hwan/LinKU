/**
 * 날짜/시간 형식 변환 및 D-Day 계산 유틸리티
 */

import { TodoItem } from "@/types/todo";
import { captureErrorLog } from "@/utils/logger";

const TODO_DATE_PATTERN = /^(\d{4})[.-](\d{1,2})[.-](\d{1,2})$/;
const TODO_TIME_PATTERN = /^(\d{1,2}):(\d{2})$/;
const INVALID_TODO_DEADLINE = "2099-12-31T23:59:59";

const parseTodoTime = (
  dueTime: string,
): { hour: number; minute: number } | null => {
  const match = TODO_TIME_PATTERN.exec(dueTime);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;

  return { hour, minute };
};

/**
 * Todo 날짜와 시간을 런타임에서 검증해 Date 객체로 변환
 * TypeScript 타입만으로는 storage/eCampus에서 들어오는 문자열을 검증할 수 없다.
 */
export function parseTodoDateTime(
  dueDate: string,
  dueTime: string,
): Date | null {
  const dateMatch = TODO_DATE_PATTERN.exec(dueDate);
  const time = parseTodoTime(dueTime);
  if (!dateMatch || !time) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const parsed = new Date(
    year,
    month - 1,
    day,
    time.hour,
    time.minute,
    0,
    0,
  );

  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day ||
    parsed.getHours() !== time.hour ||
    parsed.getMinutes() !== time.minute
  ) {
    return null;
  }

  return parsed;
}

/**
 * 24시간 형식을 12시간 형식 + 오전/오후로 변환
 * @param time24 24시간 형식 시간 (HH:mm)
 * @returns 12시간 형식 시간 (오전/오후 HH:mm)
 */
export function format24to12Hour(time24: string): string {
  const parsedTime = parseTodoTime(time24);
  if (!parsedTime) return time24;

  const { hour: hour24, minute } = parsedTime;

  // 오전/오후 결정
  const period = hour24 < 12 ? '오전' : '오후';

  // 12시간 형식으로 변환
  let hour12 = hour24 % 12;
  if (hour12 === 0) hour12 = 12; // 0시 → 12시, 12시 → 12시

  // 분이 한 자리수면 0 붙이기
  const formattedMinute = minute < 10 ? `0${minute}` : minute;

  return `${period} ${hour12}:${formattedMinute}`;
}

/**
 * Custom Todo의 날짜와 시간을 eCampus 형식으로 포맷
 * @param dueDate 날짜 (YYYY.MM.DD)
 * @param dueTime 시간 (HH:mm 24시간 형식)
 * @returns 포맷된 문자열 (YYYY.MM.DD 오전/오후 HH:mm)
 */
export function formatTodoDateTime(dueDate: string, dueTime: string): string {
  const formattedTime = format24to12Hour(dueTime);
  return `${dueDate} ${formattedTime}`;
}

/**
 * D-Day 계산 함수
 * @param dueDate 마감 날짜 (YYYY.MM.DD 또는 YYYY-MM-DD 형식)
 * @param dueTime 마감 시간 (HH:mm 형식)
 * @returns D-Day 문자열 (예: "D-3", "D-Day", "마감", "D+2")
 */
export function calculateDDay(dueDate: string, dueTime: string): string {
  try {
    const dueDateTime = parseTodoDateTime(dueDate, dueTime);
    if (!dueDateTime) {
      captureErrorLog("[calculateDDay] Invalid date or time");
      return "D-Day";
    }

    const now = new Date();

    // 날짜 차이 계산 (자정 기준)
    const dueDay = new Date(dueDateTime);
    dueDay.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dateDiffMs = dueDay.getTime() - today.getTime();
    const dateDiff = Math.floor(dateDiffMs / (1000 * 60 * 60 * 24));

    // 시간 차이 계산 (밀리초)
    const timeDiffMs = dueDateTime.getTime() - now.getTime();

    if (dateDiff < 0) {
      // 과거 날짜: D+1, D+2, ...
      return `D+${Math.abs(dateDiff)}`;
    } else if (dateDiff > 0) {
      // 미래 날짜: D-1, D-2, ...
      return `D-${dateDiff}`;
    } else {
      // 같은 날 (dateDiff === 0)
      if (timeDiffMs < 0) {
        // 오늘인데 시간은 이미 지남 → "마감"으로 표시
        return "마감";
      } else {
        // 오늘인데 시간은 아직 안 지남
        return "D-Day";
      }
    }
  } catch (error) {
    captureErrorLog("[calculateDDay] Error calculating D-Day:", error);
    return "D-Day";
  }
}

/**
 * eCampus 형식의 마감일을 Date 객체로 변환
 * @param dueDate "2025.10.11 오후 11:59" 형식
 * @returns Date 객체
 */
export function parseECampusDueDate(dueDate: string): Date {
  const parsed = parseECampusToTimerFormat(dueDate);
  if (!parsed) {
    return new Date(INVALID_TODO_DEADLINE);
  }

  return (
    parseTodoDateTime(parsed.date, parsed.time) ??
    new Date(INVALID_TODO_DEADLINE)
  );
}

/**
 * eCampus 형식의 마감일을 타이머 형식으로 변환
 * @param dueDate "2025.10.11 오후 11:59" 형식
 * @returns { date: "2025.10.11", time: "23:59" } 또는 null
 */
export function parseECampusToTimerFormat(dueDate: string): { date: string; time: string } | null {
  const match =
    /^(\d{4})\.(\d{1,2})\.(\d{1,2})\s+(오전|오후)\s+(\d{1,2}):(\d{2})$/.exec(
      dueDate.trim(),
    );
  if (!match) return null;

  const [, year, month, day, period, hourText, minuteText] = match;
  const hour12 = Number(hourText);
  const minute = Number(minuteText);
  if (hour12 < 1 || hour12 > 12 || minute > 59) return null;

  let hour24 = hour12 % 12;
  if (period === "오후") {
    hour24 += 12;
  }

  const pad = (value: string | number) => String(value).padStart(2, "0");
  const date = `${year}.${pad(month)}.${pad(day)}`;
  const time = `${pad(hour24)}:${pad(minute)}`;

  return parseTodoDateTime(date, time) ? { date, time } : null;
}

/**
 * TodoItem의 실제 마감 시간을 Date 객체로 반환
 * @param todo TodoItem (eCampus 또는 Custom)
 * @returns Date 객체
 */
export function getTodoDeadline(todo: TodoItem): Date {
  if (todo.type === 'ecampus') {
    return parseECampusDueDate(todo.dueDate);
  }

  return (
    parseTodoDateTime(todo.dueDate, todo.dueTime) ??
    new Date(INVALID_TODO_DEADLINE)
  );
}
