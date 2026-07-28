-- 初期投入データ (PMF アンケート) の設問 1 のみ回答必須にする
UPDATE "FeedbackQuestion"
SET
    "required" = true,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE
    "id" = 'feedback-question-pmf-2026-1';
