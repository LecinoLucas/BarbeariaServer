-- CreateTable
CREATE TABLE "schedule_blocks" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "reason" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "schedule_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "schedule_blocks_professionalId_idx" ON "schedule_blocks"("professionalId");

-- CreateIndex
CREATE INDEX "schedule_blocks_startAt_idx" ON "schedule_blocks"("startAt");

-- CreateIndex
CREATE INDEX "schedule_blocks_endAt_idx" ON "schedule_blocks"("endAt");

-- CreateIndex
CREATE INDEX "schedule_blocks_isActive_idx" ON "schedule_blocks"("isActive");

-- CreateIndex
CREATE INDEX "schedule_blocks_deletedAt_idx" ON "schedule_blocks"("deletedAt");

-- CreateIndex
CREATE INDEX "schedule_blocks_professionalId_startAt_idx" ON "schedule_blocks"("professionalId", "startAt");

-- CreateIndex
CREATE INDEX "schedule_blocks_professionalId_startAt_endAt_idx" ON "schedule_blocks"("professionalId", "startAt", "endAt");

-- AddForeignKey
ALTER TABLE "schedule_blocks" ADD CONSTRAINT "schedule_blocks_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "professionals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
