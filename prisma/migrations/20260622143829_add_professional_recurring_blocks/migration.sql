-- CreateTable
CREATE TABLE "professional_recurring_blocks" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "reason" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "professional_recurring_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "professional_recurring_blocks_professionalId_idx" ON "professional_recurring_blocks"("professionalId");

-- CreateIndex
CREATE INDEX "professional_recurring_blocks_professionalId_dayOfWeek_idx" ON "professional_recurring_blocks"("professionalId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "professional_recurring_blocks_professionalId_isActive_idx" ON "professional_recurring_blocks"("professionalId", "isActive");

-- AddForeignKey
ALTER TABLE "professional_recurring_blocks" ADD CONSTRAINT "professional_recurring_blocks_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "professionals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
