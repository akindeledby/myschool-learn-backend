-- CreateTable
CREATE TABLE "OfflineTestSubmission" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "clientAttemptId" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfflineTestSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OfflineTestSubmission_studentId_idx" ON "OfflineTestSubmission"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "OfflineTestSubmission_studentId_clientAttemptId_key" ON "OfflineTestSubmission"("studentId", "clientAttemptId");
