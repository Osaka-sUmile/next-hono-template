import { createRoute, z } from "@hono/zod-openapi"
import {
  FEEDBACK_SURVEY_SLUG_MAX_LENGTH,
  FEEDBACK_SURVEY_TITLE_MAX_LENGTH,
} from "@workspace/domain"
import { errorResponses } from "../openapi"

/**
 * API 境界での入力上限。DB・メモリ負荷と、ドメイン検証まで到達させたくない
 * 明らかに過大な入力をここで弾く（issue #128）。
 * FEEDBACK_TEXT_MAX_LENGTH は FeedbackSubmissionEntity 側の上限と同じ値を保つ。
 */
const FEEDBACK_ID_MAX_LENGTH = 64
const FEEDBACK_CHOICE_VALUE_MAX_LENGTH = 100
const FEEDBACK_TEXT_MAX_LENGTH = 2000
const FEEDBACK_ANSWERS_MAX_COUNT = 50
const FEEDBACK_QUESTIONS_MAX_COUNT = FEEDBACK_ANSWERS_MAX_COUNT
const FEEDBACK_CHOICES_MAX_COUNT = 20
const FEEDBACK_CHOICE_LABEL_MAX_LENGTH = 200
const SUBMISSION_LIST_MAX_LIMIT = 100
const SUBMISSION_LIST_DEFAULT_LIMIT = 20

const feedbackIdSchema = z.string().trim().min(1).max(FEEDBACK_ID_MAX_LENGTH)

const FeedbackChoiceSchema = z
  .object({
    value: z
      .string()
      .openapi({ description: "Stable value used as the tally key" }),
    label: z.string().openapi({ description: "Label shown to respondents" }),
    sortOrder: z
      .number()
      .int()
      .openapi({ description: "Display order within the question" }),
  })
  .openapi("FeedbackChoice")

const FeedbackQuestionSchema = z
  .object({
    id: z.string(),
    type: z
      .enum(["single_choice", "text"])
      .openapi({ description: "Answer input type" }),
    text: z.string(),
    required: z.boolean(),
    sortOrder: z.number().int(),
    choices: z
      .array(FeedbackChoiceSchema)
      .openapi({ description: "Empty for text questions" }),
  })
  .openapi("FeedbackQuestion")

const FeedbackSurveySchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
    questions: z.array(FeedbackQuestionSchema),
  })
  .openapi("FeedbackSurvey")

const FeedbackSurveyListItemSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
    isActive: z
      .boolean()
      .openapi({ description: "Whether respondents can currently answer it" }),
    questionCount: z.number().int(),
    submissionCount: z.number().int().openapi({
      description: "Total submissions, including repeat submissions",
    }),
    createdAt: z.string().datetime(),
  })
  .openapi("FeedbackSurveyListItem")

const FeedbackSurveyListSchema = z
  .object({
    items: z.array(FeedbackSurveyListItemSchema),
  })
  .openapi("FeedbackSurveyList")

const FeedbackSurveyDetailSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
    isActive: z.boolean(),
    createdAt: z.string().datetime(),
    questions: z.array(FeedbackQuestionSchema),
  })
  .openapi("FeedbackSurveyDetail")

const GetFeedbackSurveyDetailParamsSchema = z.object({
  surveyId: feedbackIdSchema.openapi({
    param: { name: "surveyId", in: "path", required: true },
    description: "Survey to retrieve",
  }),
})

const UpdateFeedbackSurveyParamsSchema = z.object({
  surveyId: feedbackIdSchema.openapi({
    param: { name: "surveyId", in: "path", required: true },
    description: "Survey to update",
  }),
})

const DraftFeedbackSurveyParamsSchema = z.object({
  surveyId: feedbackIdSchema.openapi({
    param: { name: "surveyId", in: "path", required: true },
    description: "Draft survey to mutate",
  }),
})

const DuplicateFeedbackSurveyParamsSchema = z.object({
  surveyId: feedbackIdSchema.openapi({
    param: { name: "surveyId", in: "path", required: true },
    description: "Survey to copy questions from",
  }),
})

// Domain の regex は非公開なので API 境界で同じ契約を明示的にミラーする。
const FEEDBACK_SURVEY_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const feedbackSurveySlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(FEEDBACK_SURVEY_SLUG_MAX_LENGTH)
  .regex(FEEDBACK_SURVEY_SLUG_REGEX)

const feedbackSurveyTitleSchema = z
  .string()
  .trim()
  .min(1)
  .max(FEEDBACK_SURVEY_TITLE_MAX_LENGTH)

const CreateFeedbackChoiceSchema = z.strictObject({
  value: z.string().trim().min(1).max(FEEDBACK_CHOICE_VALUE_MAX_LENGTH),
  label: z.string().trim().min(1).max(FEEDBACK_CHOICE_LABEL_MAX_LENGTH),
})

const CreateFeedbackQuestionSchema = z
  .strictObject({
    type: z.enum(["single_choice", "text"]),
    text: z.string().trim().min(1).max(FEEDBACK_TEXT_MAX_LENGTH),
    required: z.boolean().default(false),
    choices: z
      .array(CreateFeedbackChoiceSchema)
      .max(FEEDBACK_CHOICES_MAX_COUNT)
      .default([]),
  })
  .superRefine((question, ctx) => {
    if (question.type === "text" && question.choices.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["choices"],
        message: "text questions must not have choices",
      })
    }
    if (question.type === "single_choice" && question.choices.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["choices"],
        message: "single_choice questions must have at least one choice",
      })
    }

    const seenValues = new Set<string>()
    question.choices.forEach((choice, index) => {
      if (seenValues.has(choice.value)) {
        ctx.addIssue({
          code: "custom",
          path: ["choices", index, "value"],
          message: "choice values must be unique within a question",
        })
      }
      seenValues.add(choice.value)
    })
  })

const CreateFeedbackSurveyBodySchema = z
  .strictObject({
    slug: feedbackSurveySlugSchema,
    title: feedbackSurveyTitleSchema,
    isActive: z.boolean().default(false),
    // sortOrder は受け取らず、Entity が配列インデックスから導出する。
    questions: z
      .array(CreateFeedbackQuestionSchema)
      .max(FEEDBACK_QUESTIONS_MAX_COUNT)
      .default([]),
  })
  .superRefine((body, ctx) => {
    // ボディ内で完結する矛盾なので 400。保存済み survey の PATCH 有効化は 409。
    if (body.isActive && body.questions.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["isActive"],
        message: "a survey without questions cannot be activated",
      })
    }
  })

const UpdateFeedbackSurveyBodySchema = z
  .strictObject({
    slug: feedbackSurveySlugSchema.optional(),
    title: feedbackSurveyTitleSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "at least one of slug, title, or isActive must be provided",
  })
  .openapi({ minProperties: 1 })

const ReplaceFeedbackSurveyQuestionsBodySchema = z.strictObject({
  questions: z
    .array(CreateFeedbackQuestionSchema)
    .max(FEEDBACK_QUESTIONS_MAX_COUNT),
})

const DuplicateFeedbackSurveyBodySchema = z.strictObject({
  slug: feedbackSurveySlugSchema,
  title: feedbackSurveyTitleSchema,
})

const FeedbackSurveyMutationResultSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
    isActive: z.boolean(),
    questions: z.array(FeedbackQuestionSchema),
  })
  .openapi("FeedbackSurveyMutationResult")

/**
 * 回答投稿のリクエストボディ。
 * 投稿者は認証セッションから決めるため userId は受け取らない。混入した余剰キーは
 * strictObject で 400 にし、なりすましの意図が黙って無視されないようにする。
 */
const SubmitFeedbackBodySchema = z.strictObject({
  answers: z
    .array(
      z.strictObject({
        questionId: feedbackIdSchema,
        choiceValue: z
          .string()
          .trim()
          .max(FEEDBACK_CHOICE_VALUE_MAX_LENGTH)
          .optional()
          .openapi({ description: "Required for single_choice questions" }),
        textValue: z
          .string()
          .max(FEEDBACK_TEXT_MAX_LENGTH)
          .optional()
          .openapi({ description: "Required for text questions" }),
      })
    )
    .max(FEEDBACK_ANSWERS_MAX_COUNT)
    .openapi({ description: "One entry per answered question" }),
})

const FeedbackSubmissionAcceptedSchema = z
  .object({
    id: z.string(),
    surveyId: z.string(),
    createdAt: z.string().datetime(),
  })
  .openapi("FeedbackSubmissionAccepted")

const FeedbackSubmissionAnswerSchema = z
  .object({
    questionId: z.string(),
    questionText: z.string(),
    choiceValue: z.string().nullable(),
    choiceLabel: z.string().nullable(),
    textValue: z.string().nullable(),
  })
  .openapi("FeedbackSubmissionAnswer")

const FeedbackSubmissionSchema = z
  .object({
    id: z.string(),
    surveyId: z.string(),
    user: z.object({
      id: z.string(),
      email: z.email(),
      name: z.string(),
      displayName: z.string().nullable(),
    }),
    createdAt: z.string().datetime(),
    answers: z.array(FeedbackSubmissionAnswerSchema),
  })
  .openapi("FeedbackSubmission")

const FeedbackSubmissionListSchema = z
  .object({
    items: z.array(FeedbackSubmissionSchema),
    total: z
      .number()
      .int()
      .openapi({ description: "Total submissions matching the filter" }),
    limit: z.number().int(),
    offset: z.number().int(),
  })
  .openapi("FeedbackSubmissionList")

const FeedbackSummarySchema = z
  .object({
    surveyId: z.string(),
    respondentCount: z.number().int().openapi({
      description:
        "Distinct respondents, counting only each user's latest submission",
    }),
    tallies: z
      .array(
        z.object({
          questionId: z.string(),
          choiceValue: z.string(),
          count: z.number().int(),
        })
      )
      .openapi({
        description:
          "Single-choice tallies only; text answers are not aggregated",
      }),
  })
  .openapi("FeedbackSummary")

const ListFeedbackSubmissionsQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(SUBMISSION_LIST_MAX_LIMIT)
    .default(SUBMISSION_LIST_DEFAULT_LIMIT)
    .openapi({
      param: { name: "limit", in: "query" },
      description: `Page size (1-${SUBMISSION_LIST_MAX_LIMIT})`,
    }),
  // param.schema を明示するのは、z.coerce.number() が null を 0 に変換する
  // (Number(null) === 0) ため min(0) では null が検証を通り、生成物にこの項目だけ
  // nullable: true が載って apps/web の型が number | null になってしまうため。
  // クエリ文字列に null は現れないので、契約としては非 null の integer が正しい。
  // limit 側は min(1) が null 由来の 0 を弾くため、この指定は不要。
  offset: z.coerce
    .number()
    .int()
    .min(0)
    .default(0)
    .openapi({
      param: {
        name: "offset",
        in: "query",
        schema: { type: "integer", minimum: 0, default: 0 },
      },
      description: "Number of submissions to skip",
    }),
  surveyId: feedbackIdSchema.optional().openapi({
    param: { name: "surveyId", in: "query" },
    description: "Restrict to one survey. Omit to include every survey.",
  }),
})

const SummarizeFeedbackQuerySchema = z.object({
  surveyId: feedbackIdSchema.openapi({
    param: { name: "surveyId", in: "query" },
    description: "Survey to aggregate",
  }),
})

export const getActiveFeedbackSurveyRoute = createRoute({
  method: "get",
  path: "/feedback/survey",
  tags: ["Feedback"],
  summary: "Get the active feedback survey",
  description:
    "Returns the questions and choices of the currently active survey. Requires an authenticated session.",
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      description: "The active survey",
      content: { "application/json": { schema: FeedbackSurveySchema } },
    },
    ...errorResponses({
      401: "Unauthorized (missing or invalid session)",
      404: "No survey is currently active (FEEDBACK_SURVEY_NOT_FOUND)",
      500: "Internal Server Error",
    }),
  },
})

export const submitFeedbackRoute = createRoute({
  method: "post",
  path: "/feedback/submissions",
  tags: ["Feedback"],
  summary: "Submit answers to the active feedback survey",
  description:
    "Records the authenticated user's answers. Repeat submissions are allowed; aggregation uses only each user's latest submission.",
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: SubmitFeedbackBodySchema } },
    },
  },
  responses: {
    201: {
      description: "The submission was recorded",
      content: {
        "application/json": { schema: FeedbackSubmissionAcceptedSchema },
      },
    },
    ...errorResponses({
      400: "Request validation failed (VALIDATION_ERROR) or the answers violate the survey contract (FEEDBACK_INVALID_ANSWER)",
      401: "Unauthorized (missing or invalid session)",
      404: "No survey is currently active (FEEDBACK_SURVEY_NOT_FOUND)",
      429: "Too many submissions (RATE_LIMIT_EXCEEDED)",
      500: "Internal Server Error",
    }),
  },
})

export const listFeedbackSurveysRoute = createRoute({
  method: "get",
  path: "/admin/feedback/surveys",
  tags: ["Admin"],
  summary: "List feedback surveys (admin only)",
  description:
    "Returns every survey newest first, including inactive ones, with question and submission counts. Requires an admin session.",
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      description: "Every survey",
      content: { "application/json": { schema: FeedbackSurveyListSchema } },
    },
    ...errorResponses({
      401: "Unauthorized (missing or invalid session)",
      403: "Forbidden (authenticated but not an admin)",
      500: "Internal Server Error",
    }),
  },
})

export const createFeedbackSurveyRoute = createRoute({
  method: "post",
  path: "/admin/feedback/surveys",
  tags: ["Admin"],
  summary: "Create a feedback survey (admin only)",
  description:
    "Creates a survey with its questions and choices. Activating it deactivates every other survey.",
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      required: true,
      content: {
        "application/json": { schema: CreateFeedbackSurveyBodySchema },
      },
    },
  },
  responses: {
    201: {
      description: "The survey was created",
      content: {
        "application/json": { schema: FeedbackSurveyMutationResultSchema },
      },
    },
    ...errorResponses({
      400: "Request validation failed (VALIDATION_ERROR)",
      401: "Unauthorized (missing or invalid session)",
      403: "Forbidden (authenticated but not an admin)",
      409: "Slug conflict or survey cannot be published (FEEDBACK_SURVEY_SLUG_CONFLICT / FEEDBACK_SURVEY_NOT_PUBLISHABLE)",
      500: "Internal Server Error",
    }),
  },
})

export const getFeedbackSurveyDetailRoute = createRoute({
  method: "get",
  path: "/admin/feedback/surveys/{surveyId}",
  tags: ["Admin"],
  summary: "Get one feedback survey with its questions (admin only)",
  description:
    "Returns the survey with its questions and choices. The summary endpoint returns tallies keyed by questionId and choiceValue only, so this is what supplies the labels. Requires an admin session.",
  security: [{ cookieAuth: [] }],
  request: { params: GetFeedbackSurveyDetailParamsSchema },
  responses: {
    200: {
      description: "The survey and its questions",
      content: { "application/json": { schema: FeedbackSurveyDetailSchema } },
    },
    ...errorResponses({
      400: "Invalid surveyId (VALIDATION_ERROR)",
      401: "Unauthorized (missing or invalid session)",
      403: "Forbidden (authenticated but not an admin)",
      404: "No survey has that id (FEEDBACK_SURVEY_NOT_FOUND)",
      500: "Internal Server Error",
    }),
  },
})

export const updateFeedbackSurveyRoute = createRoute({
  method: "patch",
  path: "/admin/feedback/surveys/{surveyId}",
  tags: ["Admin"],
  summary: "Update a feedback survey (admin only)",
  description:
    "Updates slug, title, or active state. Activating it deactivates every other survey.",
  security: [{ cookieAuth: [] }],
  request: {
    params: UpdateFeedbackSurveyParamsSchema,
    body: {
      required: true,
      content: {
        "application/json": { schema: UpdateFeedbackSurveyBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: "The updated survey",
      content: {
        "application/json": { schema: FeedbackSurveyMutationResultSchema },
      },
    },
    ...errorResponses({
      400: "Request validation failed (VALIDATION_ERROR)",
      401: "Unauthorized (missing or invalid session)",
      403: "Forbidden (authenticated but not an admin)",
      404: "No survey has that id (FEEDBACK_SURVEY_NOT_FOUND)",
      409: "Slug conflict or survey cannot be published (FEEDBACK_SURVEY_SLUG_CONFLICT / FEEDBACK_SURVEY_NOT_PUBLISHABLE)",
      500: "Internal Server Error",
    }),
  },
})

export const replaceFeedbackSurveyQuestionsRoute = createRoute({
  method: "patch",
  path: "/admin/feedback/surveys/{surveyId}/questions",
  tags: ["Admin"],
  summary: "Replace every question in a draft survey (admin only)",
  description:
    "Replaces the complete question set. The survey must be inactive and have no submissions. Question and choice ids are regenerated.",
  security: [{ cookieAuth: [] }],
  request: {
    params: DraftFeedbackSurveyParamsSchema,
    body: {
      required: true,
      content: {
        "application/json": {
          schema: ReplaceFeedbackSurveyQuestionsBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "The survey with its replacement question set",
      content: {
        "application/json": { schema: FeedbackSurveyMutationResultSchema },
      },
    },
    ...errorResponses({
      400: "Request validation failed (VALIDATION_ERROR)",
      401: "Unauthorized (missing or invalid session)",
      403: "Forbidden (authenticated but not an admin)",
      404: "No survey has that id (FEEDBACK_SURVEY_NOT_FOUND)",
      409: "Survey is active or already has submissions (FEEDBACK_SURVEY_MUST_BE_INACTIVE / FEEDBACK_SURVEY_HAS_SUBMISSIONS)",
      500: "Internal Server Error",
    }),
  },
})

export const duplicateFeedbackSurveyRoute = createRoute({
  method: "post",
  path: "/admin/feedback/surveys/{surveyId}/duplicate",
  tags: ["Admin"],
  summary: "Duplicate a feedback survey (admin only)",
  description:
    "Copies questions and choices into a new inactive survey with new ids. Submissions and answers are not copied.",
  security: [{ cookieAuth: [] }],
  request: {
    params: DuplicateFeedbackSurveyParamsSchema,
    body: {
      required: true,
      content: {
        "application/json": { schema: DuplicateFeedbackSurveyBodySchema },
      },
    },
  },
  responses: {
    201: {
      description: "The new inactive survey",
      content: {
        "application/json": { schema: FeedbackSurveyMutationResultSchema },
      },
    },
    ...errorResponses({
      400: "Request validation failed (VALIDATION_ERROR)",
      401: "Unauthorized (missing or invalid session)",
      403: "Forbidden (authenticated but not an admin)",
      404: "No survey has that id (FEEDBACK_SURVEY_NOT_FOUND)",
      409: "Slug conflict (FEEDBACK_SURVEY_SLUG_CONFLICT)",
      500: "Internal Server Error",
    }),
  },
})

export const deleteFeedbackSurveyRoute = createRoute({
  method: "delete",
  path: "/admin/feedback/surveys/{surveyId}",
  tags: ["Admin"],
  summary: "Delete an unsubmitted draft survey (admin only)",
  description:
    "Hard-deletes an inactive survey only when it has no submissions. Its slug becomes reusable.",
  security: [{ cookieAuth: [] }],
  request: { params: DraftFeedbackSurveyParamsSchema },
  responses: {
    204: { description: "The survey was deleted" },
    ...errorResponses({
      400: "Invalid surveyId (VALIDATION_ERROR)",
      401: "Unauthorized (missing or invalid session)",
      403: "Forbidden (authenticated but not an admin)",
      404: "No survey has that id (FEEDBACK_SURVEY_NOT_FOUND)",
      409: "Survey is active or already has submissions (FEEDBACK_SURVEY_MUST_BE_INACTIVE / FEEDBACK_SURVEY_HAS_SUBMISSIONS)",
      500: "Internal Server Error",
    }),
  },
})

export const listFeedbackSubmissionsRoute = createRoute({
  method: "get",
  path: "/admin/feedback/submissions",
  tags: ["Admin"],
  summary: "List feedback submissions (admin only)",
  description:
    "Returns submissions newest first, including respondent identity and free-text answers. Requires an admin session.",
  security: [{ cookieAuth: [] }],
  request: { query: ListFeedbackSubmissionsQuerySchema },
  responses: {
    200: {
      description: "A page of submissions",
      content: { "application/json": { schema: FeedbackSubmissionListSchema } },
    },
    ...errorResponses({
      400: "Invalid paging or filter parameters (VALIDATION_ERROR)",
      401: "Unauthorized (missing or invalid session)",
      403: "Forbidden (authenticated but not an admin)",
      500: "Internal Server Error",
    }),
  },
})

export const summarizeFeedbackRoute = createRoute({
  method: "get",
  path: "/admin/feedback/summary",
  tags: ["Admin"],
  summary: "Summarize feedback answers (admin only)",
  description:
    "Tallies single-choice answers for one survey, counting only each user's latest submission. Requires an admin session.",
  security: [{ cookieAuth: [] }],
  request: { query: SummarizeFeedbackQuerySchema },
  responses: {
    200: {
      description: "The tallies for the survey",
      content: { "application/json": { schema: FeedbackSummarySchema } },
    },
    ...errorResponses({
      400: "Missing or invalid surveyId (VALIDATION_ERROR)",
      401: "Unauthorized (missing or invalid session)",
      403: "Forbidden (authenticated but not an admin)",
      500: "Internal Server Error",
    }),
  },
})
