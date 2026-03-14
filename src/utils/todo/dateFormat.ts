/**
 * 날짜/시간 형식 변환 및 D-Day 계산 유틸리티
 */

import { TodoItem } from "@/types/todo";

/**
 * 24시간 형식을 12시간 형식 + 오전/오후로 변환
 * @param time24 24시간 형식 시간 (HH:mm)
 * @returns 12시간 형식 시간 (오전/오후 HH:mm)
 */
export function format24to12Hour(time24: string): string {
  const [hour24, minute] = time24.split(':').map(Number);

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
    // 날짜 형식 정규화: YYYY-MM-DD → YYYY.MM.DD
    const normalizedDate = dueDate.replace(/-/g, ".");
    const [year, month, day] = normalizedDate.split(".").map(Number);
    const [hour, minute] = dueTime.split(":").map(Number);

    // 유효성 검사
    if (!year || !month || !day) {
      console.error(`[calculateDDay] Invalid date: ${dueDate}`);
      return "D-Day";
    }

    // 마감일시 (시간 포함)
    const dueDateTime = new Date(year, month - 1, day, hour, minute, 0);
    const now = new Date();

    // 날짜 차이 계산 (자정 기준)
    const dueDay = new Date(year, month - 1, day);
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
    console.error(`[calculateDDay] Error calculating D-Day:`, error);
    return "D-Day";
  }
}

/**
 * eCampus 형식의 마감일을 Date 객체로 변환
 * @param dueDate "2025.10.11 오후 11:59" 형식
 * @returns Date 객체
 */
export function parseECampusDueDate(dueDate: string): Date {
  try {
    // "2025.10.11 오후 11:59" 형식 파싱
    const parts = dueDate.split(' ');
    if (parts.length < 3) {
      throw new Error('Invalid date format');
    }

    const datePart = parts[0]; // "2025.10.11"
    const period = parts[1]; // "오전" or "오후"
    const timePart = parts[2]; // "11:59"

    const [year, month, day] = datePart.split('.').map(Number);
    const [hours, minutes] = timePart.split(':').map(Number);

    // 오전/오후를 24시간 형식으로 변환
    let hour24 = hours;
    if (period === '오후' && hours !== 12) {
      hour24 = hours + 12;
    } else if (period === '오전' && hours === 12) {
      hour24 = 0;
    }

    return new Date(year, month - 1, day, hour24, minutes);
  } catch (error) {
    console.error('Error parsing eCampus due date:', dueDate, error);
    // 파싱 실패 시 먼 미래 반환 (정렬 시 맨 뒤로)
    return new Date('2099-12-31T23:59:59');
  }
}

/**
 * eCampus 형식의 마감일을 타이머 형식으로 변환
 * @param dueDate "2025.10.11 오후 11:59" 형식
 * @returns { date: "2025.10.11", time: "23:59" } 또는 null
 */
export function parseECampusToTimerFormat(dueDate: string): { date: string; time: string } | null {
  try {
    const parts = dueDate.split(' ');
    if (parts.length < 3) return null;

    const date = parts[0]; // "2025.10.11"
    const period = parts[1]; // "오후" or "오전"
    const timeStr = parts[2]; // "11:59"

    const [hours, minutes] = timeStr.split(':').map(Number);

    // 24시간 형식으로 변환
    let hour24 = hours;
    if (period === '오후' && hours !== 12) {
      hour24 = hours + 12;
    } else if (period === '오전' && hours === 12) {
      hour24 = 0;
    }

    const time = `${String(hour24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

    return { date, time };
  } catch (error) {
    console.error('Error parsing eCampus dueDate:', error);
    return null;
  }
}

/**
 * TodoItem의 실제 마감 시간을 Date 객체로 반환
 * @param todo TodoItem (eCampus 또는 Custom)
 * @returns Date 객체
 */
export function getTodoDeadline(todo: TodoItem): Date {
  if (todo.type === 'ecampus') {
    return parseECampusDueDate(todo.dueDate);
  } else {
    try {
      // Custom Todo: "2025.10.11" + "23:59"
      const [year, month, day] = todo.dueDate.split('.').map(Number);
      const [hour, minute] = todo.dueTime.split(':').map(Number);
      return new Date(year, month - 1, day, hour, minute);
    } catch (error) {
      console.error('Error parsing custom todo deadline:', todo, error);
      // 파싱 실패 시 먼 미래 반환 (정렬 시 맨 뒤로)
      return new Date('2099-12-31T23:59:59');
    }
  }
}
