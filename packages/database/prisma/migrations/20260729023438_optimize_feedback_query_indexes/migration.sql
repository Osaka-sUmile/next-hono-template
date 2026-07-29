-- DropIndex
DROP INDEX "FeedbackSubmission_surveyId_createdAt_idx";

-- DropIndex
DROP INDEX "FeedbackSubmission_surveyId_userId_createdAt_idx";

-- CreateIndex
CREATE INDEX "FeedbackSubmission_surveyId_createdAt_id_idx" ON "FeedbackSubmission"("surveyId", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "FeedbackSubmission_surveyId_userId_createdAt_id_idx" ON "FeedbackSubmission"("surveyId", "userId", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "FeedbackSubmission_createdAt_id_idx" ON "FeedbackSubmission"("createdAt" DESC, "id" DESC);
