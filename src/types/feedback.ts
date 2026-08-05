export const feedbackCategories = [
  { value: "feature", label: "기능 제안" },
  { value: "bug", label: "오류 제보" },
  { value: "experience", label: "사용 경험" },
  { value: "other", label: "기타 의견" },
] as const;

export type FeedbackCategory = (typeof feedbackCategories)[number]["value"];

export interface FeedbackSubmission {
  submissionId: string;
  clientId: string;
  category: FeedbackCategory;
  title: string;
  message: string;
  extensionVersion: string;
  createdAt: string;
  website: string;
}

export interface FeedbackEndpointResponse {
  success: boolean;
  persisted: boolean;
  duplicate?: boolean;
  notificationSent?: boolean;
  retryable?: boolean;
  error?: string;
}

export interface FeedbackDeliveryResult {
  status: "persisted" | "queued";
  notificationSent: boolean;
}
