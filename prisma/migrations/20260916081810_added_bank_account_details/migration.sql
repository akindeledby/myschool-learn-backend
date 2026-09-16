/*
  Warnings:

  - You are about to drop the column `accountName` on the `School` table. All the data in the column will be lost.
  - You are about to drop the column `accountName` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "School" DROP COLUMN "accountName",
ADD COLUMN     "bankAccountName" TEXT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "accountName",
ADD COLUMN     "bankAccountName" TEXT;
