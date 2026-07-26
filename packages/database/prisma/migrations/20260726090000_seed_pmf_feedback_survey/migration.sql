-- SeedSurvey
INSERT INTO "FeedbackSurvey" (
    "id",
    "slug",
    "title",
    "isActive",
    "createdAt",
    "updatedAt"
) VALUES (
    'feedback-survey-pmf-2026',
    'pmf-2026',
    'PMFアンケート',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- SeedQuestions
INSERT INTO "FeedbackQuestion" (
    "id",
    "surveyId",
    "type",
    "text",
    "sortOrder",
    "createdAt",
    "updatedAt"
) VALUES
    (
        'feedback-question-pmf-2026-1',
        'feedback-survey-pmf-2026',
        'single_choice',
        'もし明日からこのサービスが使えなくなったらどう思いますか？',
        1,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'feedback-question-pmf-2026-2',
        'feedback-survey-pmf-2026',
        'text',
        'このサービスの一番の価値は何ですか？',
        2,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'feedback-question-pmf-2026-3',
        'feedback-survey-pmf-2026',
        'text',
        'このサービスを改善するとしたら何ですか？',
        3,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'feedback-question-pmf-2026-4',
        'feedback-survey-pmf-2026',
        'text',
        'サービス管理者に一言',
        4,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    );

-- SeedChoices
INSERT INTO "FeedbackChoice" (
    "id",
    "questionId",
    "value",
    "label",
    "sortOrder",
    "createdAt",
    "updatedAt"
) VALUES
    (
        'feedback-choice-pmf-2026-1-1',
        'feedback-question-pmf-2026-1',
        'very_disappointed',
        '非常に残念',
        1,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'feedback-choice-pmf-2026-1-2',
        'feedback-question-pmf-2026-1',
        'somewhat_disappointed',
        '少し残念',
        2,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'feedback-choice-pmf-2026-1-3',
        'feedback-question-pmf-2026-1',
        'not_disappointed',
        '特に何も思わない',
        3,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'feedback-choice-pmf-2026-1-4',
        'feedback-question-pmf-2026-1',
        'no_longer_use',
        'もう使っていない',
        4,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    );
