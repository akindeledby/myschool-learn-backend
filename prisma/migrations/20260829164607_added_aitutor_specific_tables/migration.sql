/*
  Warnings:

  - You are about to drop the `Progress` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TutorMemory` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "TutorLessonStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "TutorContentStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "TutorLessonEventType" AS ENUM ('LESSON_STARTED', 'OBJECTIVE_STARTED', 'EXPLANATION', 'QUESTION_ASKED', 'ANSWER_RECEIVED', 'CORRECT_ANSWER', 'INCORRECT_ANSWER', 'OBJECTIVE_COMPLETED', 'HINT_GIVEN', 'EXAMPLE_GIVEN', 'LESSON_PAUSED', 'LESSON_RESUMED', 'LESSON_COMPLETED');

-- DropForeignKey
ALTER TABLE "Progress" DROP CONSTRAINT "Progress_studentId_fkey";

-- DropForeignKey
ALTER TABLE "Progress" DROP CONSTRAINT "Progress_topicId_fkey";

-- DropForeignKey
ALTER TABLE "TutorMemory" DROP CONSTRAINT "TutorMemory_studentId_fkey";

-- AlterTable
ALTER TABLE "TutorMessage" ADD COLUMN     "lessonSessionId" TEXT;

-- DropTable
DROP TABLE "Progress";

-- DropTable
DROP TABLE "TutorMemory";

-- CreateTable
CREATE TABLE "TutorLessonProgress" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "conversationId" TEXT,
    "status" "TutorLessonStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "currentObjectiveId" TEXT,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "progressPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "lastAccessedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TutorLessonProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TutorContentProgress" (
    "id" TEXT NOT NULL,
    "lessonProgressId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "status" "TutorContentStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "correctAttempts" INTEGER NOT NULL DEFAULT 0,
    "masteryScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TutorContentProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TutorLessonMemory" (
    "id" TEXT NOT NULL,
    "lessonProgressId" TEXT NOT NULL,
    "summary" TEXT,
    "strengths" JSONB,
    "weaknesses" JSONB,
    "misconceptions" JSONB,
    "masteredConcepts" JSONB,
    "pendingConcepts" JSONB,
    "lastInteractionSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TutorLessonMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TutorLessonSession" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "lessonProgressId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "startingObjectiveId" TEXT,
    "endingObjectiveId" TEXT,
    "startingStep" INTEGER,
    "endingStep" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TutorLessonSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TutorLessonEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" "TutorLessonEventType" NOT NULL,
    "objectiveId" TEXT,
    "step" INTEGER,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TutorLessonEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentLessonProgress" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "timeSpent" INTEGER,

    CONSTRAINT "StudentLessonProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TutorLessonProgress_conversationId_key" ON "TutorLessonProgress"("conversationId");

-- CreateIndex
CREATE INDEX "TutorLessonProgress_studentId_idx" ON "TutorLessonProgress"("studentId");

-- CreateIndex
CREATE INDEX "TutorLessonProgress_topicId_idx" ON "TutorLessonProgress"("topicId");

-- CreateIndex
CREATE UNIQUE INDEX "TutorLessonProgress_studentId_topicId_key" ON "TutorLessonProgress"("studentId", "topicId");

-- CreateIndex
CREATE INDEX "TutorContentProgress_topicId_idx" ON "TutorContentProgress"("topicId");

-- CreateIndex
CREATE UNIQUE INDEX "TutorContentProgress_lessonProgressId_topicId_key" ON "TutorContentProgress"("lessonProgressId", "topicId");

-- CreateIndex
CREATE UNIQUE INDEX "TutorLessonMemory_lessonProgressId_key" ON "TutorLessonMemory"("lessonProgressId");

-- CreateIndex
CREATE UNIQUE INDEX "TutorLessonSession_conversationId_key" ON "TutorLessonSession"("conversationId");

-- CreateIndex
CREATE INDEX "TutorLessonSession_studentId_idx" ON "TutorLessonSession"("studentId");

-- CreateIndex
CREATE INDEX "TutorLessonSession_lessonProgressId_idx" ON "TutorLessonSession"("lessonProgressId");

-- CreateIndex
CREATE INDEX "TutorLessonEvent_sessionId_idx" ON "TutorLessonEvent"("sessionId");

-- CreateIndex
CREATE INDEX "TutorLessonEvent_objectiveId_idx" ON "TutorLessonEvent"("objectiveId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentLessonProgress_studentId_topicId_key" ON "StudentLessonProgress"("studentId", "topicId");

-- CreateIndex
CREATE INDEX "TutorMessage_lessonSessionId_idx" ON "TutorMessage"("lessonSessionId");

-- AddForeignKey
ALTER TABLE "TutorMessage" ADD CONSTRAINT "TutorMessage_lessonSessionId_fkey" FOREIGN KEY ("lessonSessionId") REFERENCES "TutorLessonSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorLessonProgress" ADD CONSTRAINT "TutorLessonProgress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorLessonProgress" ADD CONSTRAINT "TutorLessonProgress_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorLessonProgress" ADD CONSTRAINT "TutorLessonProgress_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "TutorConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorContentProgress" ADD CONSTRAINT "TutorContentProgress_lessonProgressId_fkey" FOREIGN KEY ("lessonProgressId") REFERENCES "TutorLessonProgress"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorContentProgress" ADD CONSTRAINT "TutorContentProgress_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorLessonMemory" ADD CONSTRAINT "TutorLessonMemory_lessonProgressId_fkey" FOREIGN KEY ("lessonProgressId") REFERENCES "TutorLessonProgress"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorLessonSession" ADD CONSTRAINT "TutorLessonSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorLessonSession" ADD CONSTRAINT "TutorLessonSession_lessonProgressId_fkey" FOREIGN KEY ("lessonProgressId") REFERENCES "TutorLessonProgress"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorLessonSession" ADD CONSTRAINT "TutorLessonSession_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "TutorConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorLessonEvent" ADD CONSTRAINT "TutorLessonEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TutorLessonSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentLessonProgress" ADD CONSTRAINT "StudentLessonProgress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentLessonProgress" ADD CONSTRAINT "StudentLessonProgress_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
