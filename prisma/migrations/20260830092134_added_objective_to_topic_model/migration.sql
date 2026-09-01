/*
  Warnings:

  - You are about to drop the `TutorContentProgress` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "TopicObjectiveSource" AS ENUM ('AI_GENERATED', 'ADMIN_CREATED');

-- CreateEnum
CREATE TYPE "TutorObjectiveStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "TopicObjectiveGenerationStatus" AS ENUM ('NOT_GENERATED', 'GENERATING', 'GENERATED', 'FAILED');

-- CreateEnum
CREATE TYPE "TutorConversationMode" AS ENUM ('GENERAL', 'TOPIC_CHAT', 'LESSON');

-- DropForeignKey
ALTER TABLE "TutorContentProgress" DROP CONSTRAINT "TutorContentProgress_lessonProgressId_fkey";

-- DropForeignKey
ALTER TABLE "TutorContentProgress" DROP CONSTRAINT "TutorContentProgress_topicId_fkey";

-- AlterTable
ALTER TABLE "Topic" ADD COLUMN     "objectiveGenerationStatus" "TopicObjectiveGenerationStatus" NOT NULL DEFAULT 'NOT_GENERATED';

-- AlterTable
ALTER TABLE "TutorConversation" ADD COLUMN     "mode" "TutorConversationMode" NOT NULL DEFAULT 'GENERAL';

-- DropTable
DROP TABLE "TutorContentProgress";

-- CreateTable
CREATE TABLE "TopicObjective" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "source" "TopicObjectiveSource" NOT NULL DEFAULT 'AI_GENERATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TopicObjective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TutorObjectiveProgress" (
    "id" TEXT NOT NULL,
    "lessonProgressId" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,
    "status" "TutorObjectiveStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "correctAttempts" INTEGER NOT NULL DEFAULT 0,
    "masteryScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TutorObjectiveProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TopicObjective_topicId_idx" ON "TopicObjective"("topicId");

-- CreateIndex
CREATE UNIQUE INDEX "TopicObjective_topicId_order_key" ON "TopicObjective"("topicId", "order");

-- CreateIndex
CREATE INDEX "TutorObjectiveProgress_objectiveId_idx" ON "TutorObjectiveProgress"("objectiveId");

-- CreateIndex
CREATE UNIQUE INDEX "TutorObjectiveProgress_lessonProgressId_objectiveId_key" ON "TutorObjectiveProgress"("lessonProgressId", "objectiveId");

-- AddForeignKey
ALTER TABLE "TopicObjective" ADD CONSTRAINT "TopicObjective_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorObjectiveProgress" ADD CONSTRAINT "TutorObjectiveProgress_lessonProgressId_fkey" FOREIGN KEY ("lessonProgressId") REFERENCES "TutorLessonProgress"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorObjectiveProgress" ADD CONSTRAINT "TutorObjectiveProgress_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "TopicObjective"("id") ON DELETE CASCADE ON UPDATE CASCADE;
