-- CreateTable
CREATE TABLE "LessonNote" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonNote_studentId_idx" ON "LessonNote"("studentId");

-- CreateIndex
CREATE INDEX "LessonNote_topicId_idx" ON "LessonNote"("topicId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonNote_studentId_topicId_key" ON "LessonNote"("studentId", "topicId");
