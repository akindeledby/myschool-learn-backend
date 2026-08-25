/*
  Warnings:

  - A unique constraint covering the columns `[studentId,subjectId]` on the table `StudentScore` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "StudentScore_studentId_key";

-- CreateIndex
CREATE UNIQUE INDEX "StudentScore_studentId_subjectId_key" ON "StudentScore"("studentId", "subjectId");
