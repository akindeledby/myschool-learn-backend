/*
  Warnings:

  - Made the column `explanation` on table `Question` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "DailyChallengeProgress" DROP CONSTRAINT "DailyChallengeProgress_challengeId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_accountId_fkey";

-- DropForeignKey
ALTER TABLE "SubjectRanking" DROP CONSTRAINT "SubjectRanking_subjectId_fkey";

-- AlterTable
ALTER TABLE "Class" ALTER COLUMN "schemeOfWorkId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "DailyChallengeProgress" ALTER COLUMN "challengeId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "MillionaireAttempt" ALTER COLUMN "subjectId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "accountId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Question" ALTER COLUMN "explanation" SET NOT NULL;

-- AlterTable
ALTER TABLE "SchemeOfWork" ALTER COLUMN "uploadedById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SpeedChallengeAttempt" ALTER COLUMN "subjectId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Subject" ALTER COLUMN "schemeOfWorkId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SubjectRanking" ALTER COLUMN "subjectId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Subscription" ALTER COLUMN "accountId" DROP NOT NULL,
ALTER COLUMN "subscriptionPlanId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Term" ALTER COLUMN "schemeOfWorkId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Topic" ALTER COLUMN "schemeOfWorkId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "SubjectRanking" ADD CONSTRAINT "SubjectRanking_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyChallengeProgress" ADD CONSTRAINT "DailyChallengeProgress_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "DailyChallenge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
