/*
  Warnings:

  - A unique constraint covering the columns `[schoolEmail]` on the table `School` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "School" ALTER COLUMN "name" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "School_schoolEmail_key" ON "School"("schoolEmail");
