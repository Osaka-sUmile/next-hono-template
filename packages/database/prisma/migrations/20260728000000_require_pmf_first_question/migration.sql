-- 初期投入データ (PMF アンケート) の設問 1 のみ回答必須にする。
-- 対象行が無いまま 0 件更新で成功すると必須化されないまま適用済みになるため、
-- 存在を検証してから更新する。
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM "FeedbackQuestion"
        WHERE "id" = 'feedback-question-pmf-2026-1'
    ) THEN
        RAISE EXCEPTION 'Feedback question not found: feedback-question-pmf-2026-1';
    END IF;

    UPDATE "FeedbackQuestion"
    SET
        "required" = true,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE
        "id" = 'feedback-question-pmf-2026-1';
END $$;
