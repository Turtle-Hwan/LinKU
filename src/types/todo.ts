/**
 * Todo 아이템 타입 정의
 * Discriminated Union 패턴 사용
 */

// 이캠퍼스 Todo
export interface ECampusTodoItem {
  type: "ecampus"; // 타입 구분자 (discriminator)
  id: string; // 고유 식별자 (예: "ecampus-0")
  title: string; // 과제/퀴즈 제목 (예: "1주차 과제")
  subject: string; // 과목명 (예: "웹프로그래밍")
  dDay: string; // D-Day 표시 (예: "D-3", "D-Day", "D+1")
  dueDate: string; // 마감일시 (예: "2025.10.14 오후 11:59")
  kj: string; // 강의 키 (eCampus API 파라미터)
  gubun: string; // 구분 (예: "report", "lecture_weeks" - eCampus API 파라미터)
  seq: string; // 시퀀스 번호 (eCampus API 파라미터)
}

// 사용자 정의 Todo
export interface CustomTodoItem {
  type: "custom"; // 타입 구분자 (discriminator)
  id: string; // 고유 식별자 (예: "custom-1696834567890-abc123")
  title: string; // 할 일 제목 (예: "알고리즘 공부")
  subject?: string; // 과목명 (선택적, 예: "자료구조")
  dDay: string; // D-Day 표시 (예: "D-3", "D-Day", "D+1")
  dueDate: string; // 마감 날짜 (YYYY.MM.DD 형식, 예: "2025.10.14")
  dueTime: string; // 마감 시간 (HH:mm 24시간 형식, 예: "23:59")
  completed: boolean; // 완료 여부
  createdAt: number; // 생성 시간 (timestamp, 예: 1696834567890)
}

export type TodoItem = ECampusTodoItem | CustomTodoItem;
