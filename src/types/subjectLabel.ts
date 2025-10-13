/**
 * Subject Label 타입 정의
 * 사용자가 과목명을 라벨로 관리할 수 있도록 함
 */

export interface SubjectLabel {
  id: string; // 고유 식별자
  name: string; // 과목명 (예: "웹프로그래밍")
  color: string; // 라벨 색상 (hex 코드, 예: "#007a30")
  createdAt: number; // 생성 시간 (timestamp)
  usageCount: number; // 사용 횟수 (자주 사용하는 과목 우선 표시용)
}
