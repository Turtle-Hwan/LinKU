/**
 * 날짜/시간 형식 변환 유틸리티
 */

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
