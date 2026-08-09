import * as z from "zod/mini";

export const FEEDBACK_LIMITS = {
  contactEmail: { max: 254 },
  title: { min: 1, max: 80 },
  message: { min: 1, max: 500 },
} as const;

const feedbackCategorySchema = z.enum([
  "feature",
  "bug",
  "experience",
  "other",
]);

const feedbackContactEmailSchema = z.pipe(
  z.string().check(
    z.trim(),
    z.toLowerCase(),
    z.maxLength(
      FEEDBACK_LIMITS.contactEmail.max,
      `이메일은 ${FEEDBACK_LIMITS.contactEmail.max}자 이하로 입력해 주세요.`,
    ),
  ),
  z.union([z.literal(""), z.email("이메일 주소를 확인해 주세요.")]),
);

const feedbackTitleSchema = z.string().check(
  z.trim(),
  z.minLength(
    FEEDBACK_LIMITS.title.min,
    `제목을 ${FEEDBACK_LIMITS.title.min}자 이상 입력해 주세요.`,
  ),
  z.maxLength(
    FEEDBACK_LIMITS.title.max,
    `제목은 ${FEEDBACK_LIMITS.title.max}자 이하로 입력해 주세요.`,
  ),
);

const feedbackMessageSchema = z.string().check(
  z.trim(),
  z.minLength(
    FEEDBACK_LIMITS.message.min,
    `내용을 ${FEEDBACK_LIMITS.message.min}자 이상 입력해 주세요.`,
  ),
  z.maxLength(
    FEEDBACK_LIMITS.message.max,
    `내용은 ${FEEDBACK_LIMITS.message.max}자 이하로 입력해 주세요.`,
  ),
);

export const feedbackInputSchema = z.object({
  contactEmail: z._default(z.optional(feedbackContactEmailSchema), ""),
  title: feedbackTitleSchema,
  message: feedbackMessageSchema,
});

export type FeedbackInput = z.infer<typeof feedbackInputSchema>;

export const feedbackSubmissionSchema = z.object({
  submissionId: z.uuid(),
  category: feedbackCategorySchema,
  title: feedbackTitleSchema,
  message: feedbackMessageSchema,
  contactEmail: z.optional(feedbackContactEmailSchema),
  extensionVersion: z.string().check(z.minLength(1)),
  createdAt: z.iso.datetime(),
  website: z.string(),
});

export type FeedbackCategory = z.infer<typeof feedbackCategorySchema>;
export type FeedbackSubmission = z.infer<typeof feedbackSubmissionSchema>;

export const feedbackEndpointResponseSchema = z.object({
  success: z.boolean(),
  persisted: z.boolean(),
  duplicate: z.optional(z.boolean()),
  contactEmailStored: z.optional(z.boolean()),
  retryable: z.optional(z.boolean()),
  error: z.optional(z.string()),
});

export type FeedbackEndpointResponse = z.infer<
  typeof feedbackEndpointResponseSchema
>;

export interface FeedbackDeliveryResult {
  status: "persisted" | "queued";
}
