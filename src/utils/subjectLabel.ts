/**
 * Subject Label 관리 유틸리티
 * chrome.storage.local에 과목 라벨 저장/불러오기/수정/삭제
 */

import { getStorage, setStorage } from "./chrome";
import { SubjectLabel } from "@/types/subjectLabel";

const SUBJECT_LABELS_KEY = "subjectLabels";

// 기본 색상 팔레트
export const DEFAULT_COLORS = [
  "#007a30", // 건대 녹색
  "#ef4444", // red
  "#f59e0b", // amber
  "#10b981", // green
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#6366f1", // indigo
];

/**
 * 모든 과목 라벨 가져오기
 */
export async function getSubjectLabels(): Promise<SubjectLabel[]> {
  try {
    const labels = await getStorage<SubjectLabel[]>(SUBJECT_LABELS_KEY);
    return labels || [];
  } catch (error) {
    console.error("[SubjectLabel] Error getting subject labels:", error);
    return [];
  }
}

/**
 * 새 과목 라벨 추가
 */
export async function addSubjectLabel(
  name: string,
  color: string
): Promise<SubjectLabel> {
  try {
    const labels = await getSubjectLabels();
    
    // 이미 같은 이름의 라벨이 있는지 확인
    const existing = labels.find((label) => label.name === name);
    if (existing) {
      return existing;
    }

    const newLabel: SubjectLabel = {
      id: `label-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      color,
      createdAt: Date.now(),
      usageCount: 0,
    };

    await setStorage({
      [SUBJECT_LABELS_KEY]: [...labels, newLabel],
    });

    return newLabel;
  } catch (error) {
    console.error("[SubjectLabel] Error adding subject label:", error);
    throw error;
  }
}

/**
 * 과목 라벨 수정
 */
export async function updateSubjectLabel(
  id: string,
  updates: Partial<Omit<SubjectLabel, "id" | "createdAt">>
): Promise<void> {
  try {
    const labels = await getSubjectLabels();
    const updatedLabels = labels.map((label) =>
      label.id === id ? { ...label, ...updates } : label
    );

    await setStorage({
      [SUBJECT_LABELS_KEY]: updatedLabels,
    });
  } catch (error) {
    console.error("[SubjectLabel] Error updating subject label:", error);
    throw error;
  }
}

/**
 * 과목 라벨 삭제
 */
export async function deleteSubjectLabel(id: string): Promise<void> {
  try {
    const labels = await getSubjectLabels();
    const filteredLabels = labels.filter((label) => label.id !== id);

    await setStorage({
      [SUBJECT_LABELS_KEY]: filteredLabels,
    });
  } catch (error) {
    console.error("[SubjectLabel] Error deleting subject label:", error);
    throw error;
  }
}

/**
 * 과목 라벨 사용 횟수 증가
 */
export async function incrementSubjectLabelUsage(name: string): Promise<void> {
  try {
    const labels = await getSubjectLabels();
    const updatedLabels = labels.map((label) =>
      label.name === name
        ? { ...label, usageCount: label.usageCount + 1 }
        : label
    );

    await setStorage({
      [SUBJECT_LABELS_KEY]: updatedLabels,
    });
  } catch (error) {
    console.error("[SubjectLabel] Error incrementing label usage:", error);
  }
}

/**
 * 과목명으로 라벨 찾기
 */
export async function getSubjectLabelByName(
  name: string
): Promise<SubjectLabel | undefined> {
  try {
    const labels = await getSubjectLabels();
    return labels.find((label) => label.name === name);
  } catch (error) {
    console.error("[SubjectLabel] Error getting label by name:", error);
    return undefined;
  }
}
