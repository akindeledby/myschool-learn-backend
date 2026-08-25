-- AlterTable
ALTER TABLE "Parent" ADD COLUMN     "profileResetAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "profileResetCodeHash" TEXT,
ADD COLUMN     "profileResetExpiresAt" TIMESTAMP(3);
