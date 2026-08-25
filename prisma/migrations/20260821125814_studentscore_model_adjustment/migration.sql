-- AlterTable
ALTER TABLE "StudentScore" ADD COLUMN     "examTotalCorrect" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "examTotalQuestions" INTEGER NOT NULL DEFAULT 0;
