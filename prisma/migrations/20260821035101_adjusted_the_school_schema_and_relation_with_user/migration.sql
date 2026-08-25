/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `School` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "SchoolStatus" AS ENUM ('PRE_REGISTERED', 'ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_schoolId_fkey";

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "status" "SchoolStatus" NOT NULL DEFAULT 'PRE_REGISTERED';

-- CreateIndex
CREATE UNIQUE INDEX "School_userId_key" ON "School"("userId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "School" ADD CONSTRAINT "School_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
