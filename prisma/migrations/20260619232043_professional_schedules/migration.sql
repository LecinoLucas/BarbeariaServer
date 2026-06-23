-- CreateTable
CREATE TABLE "professional_schedules" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "openTime" TEXT NOT NULL,
    "closeTime" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "professional_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "professional_schedules_professionalId_idx" ON "professional_schedules"("professionalId");

-- CreateIndex
CREATE INDEX "professional_schedules_weekday_idx" ON "professional_schedules"("weekday");

-- CreateIndex
CREATE INDEX "professional_schedules_isActive_idx" ON "professional_schedules"("isActive");

-- CreateIndex
CREATE INDEX "professional_schedules_deletedAt_idx" ON "professional_schedules"("deletedAt");

-- CreateIndex
CREATE INDEX "professional_schedules_professionalId_weekday_idx" ON "professional_schedules"("professionalId", "weekday");

-- AddForeignKey
ALTER TABLE "professional_schedules" ADD CONSTRAINT "professional_schedules_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "professionals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
