/*
  Warnings:

  - You are about to drop the column `token` on the `PasswordReset` table. All the data in the column will be lost.
  - Added the required column `codeHash` to the `PasswordReset` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "PasswordReset_token_key";

-- AlterTable
ALTER TABLE "PasswordReset" DROP COLUMN "token",
ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "codeHash" TEXT NOT NULL,
ADD COLUMN     "usedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "StudentScore" ADD COLUMN     "examTerms" JSONB;
