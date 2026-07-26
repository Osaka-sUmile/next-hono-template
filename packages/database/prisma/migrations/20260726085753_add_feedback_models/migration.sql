-- CreateEnum
CREATE TYPE "FeedbackQuestionType" AS ENUM ('single_choice', 'text');

-- CreateTable
CREATE TABLE "FeedbackSurvey" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedbackSurvey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackQuestion" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "type" "FeedbackQuestionType" NOT NULL,
    "text" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedbackQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackChoice" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedbackChoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackSubmission" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackAnswer" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "choiceId" TEXT,
    "textValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackSurvey_slug_key" ON "FeedbackSurvey"("slug");

-- CreateIndex
CREATE INDEX "FeedbackSurvey_isActive_idx" ON "FeedbackSurvey"("isActive");

-- CreateIndex
CREATE INDEX "FeedbackQuestion_surveyId_idx" ON "FeedbackQuestion"("surveyId");

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackQuestion_surveyId_sortOrder_key" ON "FeedbackQuestion"("surveyId", "sortOrder");

-- CreateIndex
CREATE INDEX "FeedbackChoice_questionId_idx" ON "FeedbackChoice"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackChoice_questionId_value_key" ON "FeedbackChoice"("questionId", "value");

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackChoice_questionId_sortOrder_key" ON "FeedbackChoice"("questionId", "sortOrder");

-- CreateIndex
CREATE INDEX "FeedbackSubmission_surveyId_createdAt_idx" ON "FeedbackSubmission"("surveyId", "createdAt");

-- CreateIndex
CREATE INDEX "FeedbackSubmission_surveyId_userId_createdAt_idx" ON "FeedbackSubmission"("surveyId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "FeedbackAnswer_questionId_choiceId_idx" ON "FeedbackAnswer"("questionId", "choiceId");

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackAnswer_submissionId_questionId_key" ON "FeedbackAnswer"("submissionId", "questionId");

-- AddForeignKey
ALTER TABLE "FeedbackQuestion" ADD CONSTRAINT "FeedbackQuestion_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "FeedbackSurvey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackChoice" ADD CONSTRAINT "FeedbackChoice_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "FeedbackQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackSubmission" ADD CONSTRAINT "FeedbackSubmission_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "FeedbackSurvey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackSubmission" ADD CONSTRAINT "FeedbackSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackAnswer" ADD CONSTRAINT "FeedbackAnswer_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "FeedbackSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackAnswer" ADD CONSTRAINT "FeedbackAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "FeedbackQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackAnswer" ADD CONSTRAINT "FeedbackAnswer_choiceId_fkey" FOREIGN KEY ("choiceId") REFERENCES "FeedbackChoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
