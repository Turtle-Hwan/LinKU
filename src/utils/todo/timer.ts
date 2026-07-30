/**
 * Todo 실시간 타이머 유틸 함수
 */

import { errorLog } from "@/utils/logger";
import { parseTodoDateTime } from "@/utils/todo/dateFormat";

export interface TimeLeft {
  hours: number;
  minutes: number;
  seconds: number;
  totalMilliseconds: number;
}

/**
 * 마감일시까지 남은 시간 계산
 * @param dueDate - "YYYY.MM.DD" 형식
 * @param dueTime - "HH:mm" 형식 (24시간)
 * @returns TimeLeft 객체 또는 null (이미 지난 경우)
 */
export function calculateTimeLeft(dueDate: string, dueTime: string): TimeLeft | null {
  try {
    const deadline = parseTodoDateTime(dueDate, dueTime);
    if (!deadline) {
      return null;
    }

    const now = new Date();

    const diff = deadline.getTime() - now.getTime();

    // 이미 지난 경우
    if (diff <= 0) {
      return null;
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return {
      hours,
      minutes,
      seconds,
      totalMilliseconds: diff,
    };
  } catch (error) {
    errorLog('Error calculating time left:', error);
    return null;
  }
}

/**
 * 남은 시간을 HH:mm:ss 형식으로 포맷
 * @param timeLeft - TimeLeft 객체
 * @returns "23:45:12" 형식 문자열
 */
export function formatTimeLeft(timeLeft: TimeLeft): string {
  const h = String(timeLeft.hours).padStart(2, '0');
  const m = String(timeLeft.minutes).padStart(2, '0');
  const s = String(timeLeft.seconds).padStart(2, '0');

  return `${h}:${m}:${s}`;
}

/**
 * 24시간 이하로 남았는지 확인
 * @param dueDate - "YYYY.MM.DD" 형식
 * @param dueTime - "HH:mm" 형식
 * @returns 24시간 이하면 true
 */
export function shouldShowTimer(dueDate: string, dueTime: string): boolean {
  const timeLeft = calculateTimeLeft(dueDate, dueTime);

  if (!timeLeft) {
    return false;
  }

  const hoursLeft = timeLeft.totalMilliseconds / (1000 * 60 * 60);
  return hoursLeft <= 24;
}

/**
 * 12시간 이하로 남았는지 확인 (빨간색 표시용)
 * @param timeLeft - TimeLeft 객체
 * @returns 12시간 이하면 true
 */
export function isUrgent(timeLeft: TimeLeft): boolean {
  const hoursLeft = timeLeft.totalMilliseconds / (1000 * 60 * 60);
  return hoursLeft <= 12;
}
