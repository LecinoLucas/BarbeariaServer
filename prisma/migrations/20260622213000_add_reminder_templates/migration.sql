-- CreateEnum
CREATE TYPE "ReminderTemplateType" AS ENUM ('APPOINTMENT_REMINDER');

-- CreateEnum
CREATE TYPE "ReminderTemplateChannel" AS ENUM ('EMAIL', 'IN_APP', 'WHATSAPP');

-- CreateTable
CREATE TABLE "reminder_templates" (
    "id" TEXT NOT NULL,
    "type" "ReminderTemplateType" NOT NULL,
    "channel" "ReminderTemplateChannel" NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT,
    "bodyText" TEXT NOT NULL,
    "bodyHtml" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reminder_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reminder_templates_type_channel_idx" ON "reminder_templates"("type", "channel");

-- CreateIndex
CREATE INDEX "reminder_templates_type_channel_isActive_idx" ON "reminder_templates"("type", "channel", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "reminder_templates_active_type_channel_key"
ON "reminder_templates"("type", "channel")
WHERE "isActive" = true;
