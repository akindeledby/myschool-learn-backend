/*
  Warnings:

  - You are about to drop the column `examTerms` on the `StudentScore` table. All the data in the column will be lost.
  - You are about to drop the column `noOfTermsAttempted` on the `StudentScore` table. All the data in the column will be lost.
  - You are about to drop the column `noOfTestQuestions` on the `StudentScore` table. All the data in the column will be lost.
  - You are about to drop the column `testTotalScore` on the `StudentScore` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[studentId,subjectId,termId]` on the table `StudentScore` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `termId` to the `StudentScore` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `StudentScore` table without a default value. This is not possible if the table is not empty.
  - Made the column `testCount` on table `StudentScore` required. This step will fail if there are existing NULL values in that column.
  - Made the column `testLowestScore` on table `StudentScore` required. This step will fail if there are existing NULL values in that column.
  - Made the column `testHighestScore` on table `StudentScore` required. This step will fail if there are existing NULL values in that column.
  - Made the column `testAverageScore` on table `StudentScore` required. This step will fail if there are existing NULL values in that column.
  - Made the column `noOfTopics` on table `StudentScore` required. This step will fail if there are existing NULL values in that column.
  - Made the column `examTotalScore` on table `StudentScore` required. This step will fail if there are existing NULL values in that column.
  - Made the column `examCount` on table `StudentScore` required. This step will fail if there are existing NULL values in that column.
  - Made the column `examLowestScore` on table `StudentScore` required. This step will fail if there are existing NULL values in that column.
  - Made the column `examHighestScore` on table `StudentScore` required. This step will fail if there are existing NULL values in that column.
  - Made the column `examAverageScore` on table `StudentScore` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `updatedAt` to the `TopicAnalytics` table without a default value. This is not possible if the table is not empty.
  - Made the column `averageScore` on table `TopicAnalytics` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "StudentScore_studentId_subjectId_key";

-- AlterTable
ALTER TABLE "StudentScore" DROP COLUMN "examTerms",
DROP COLUMN "noOfTermsAttempted",
DROP COLUMN "noOfTestQuestions",
DROP COLUMN "testTotalScore",
ADD COLUMN     "termId" TEXT NOT NULL,
ADD COLUMN     "testTotalCorrect" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "testTotalQuestions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "testCount" SET NOT NULL,
ALTER COLUMN "testLowestScore" SET NOT NULL,
ALTER COLUMN "testLowestScore" SET DEFAULT 0,
ALTER COLUMN "testLowestScore" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "testHighestScore" SET NOT NULL,
ALTER COLUMN "testHighestScore" SET DEFAULT 0,
ALTER COLUMN "testHighestScore" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "testAverageScore" SET NOT NULL,
ALTER COLUMN "noOfTopics" SET NOT NULL,
ALTER COLUMN "examTotalScore" SET NOT NULL,
ALTER COLUMN "examTotalScore" SET DEFAULT 0,
ALTER COLUMN "examTotalScore" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "examCount" SET NOT NULL,
ALTER COLUMN "examLowestScore" SET NOT NULL,
ALTER COLUMN "examLowestScore" SET DEFAULT 0,
ALTER COLUMN "examLowestScore" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "examHighestScore" SET NOT NULL,
ALTER COLUMN "examHighestScore" SET DEFAULT 0,
ALTER COLUMN "examHighestScore" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "examAverageScore" SET NOT NULL;

-- AlterTable
ALTER TABLE "TopicAnalytics" ADD COLUMN     "attemptedQuestionIds" JSONB,
ADD COLUMN     "highestScore" DOUBLE PRECISION,
ADD COLUMN     "lastScore" DOUBLE PRECISION,
ADD COLUMN     "lowestScore" DOUBLE PRECISION,
ADD COLUMN     "testCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalCorrect" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalQuestions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "completionRate" SET DEFAULT 0,
ALTER COLUMN "averageScore" SET NOT NULL,
ALTER COLUMN "averageScore" SET DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "StudentScore_studentId_subjectId_termId_key" ON "StudentScore"("studentId", "subjectId", "termId");

-- AddForeignKey
ALTER TABLE "StudentScore" ADD CONSTRAINT "StudentScore_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;
