import { z } from "zod";

import { REMINDER_CHANNEL_VALUES } from "../../constants/reminderChannel.js";
import { REMINDER_STATUS_VALUES } from "../../constants/reminderStatus.js";
import { ValidationError } from "../../errors/ValidationError.js";

const reminderStatusSchema = z.enum(REMINDER_STATUS_VALUES, {
  errorMap: () => ({ message: "Status do lembrete inválido." }),
});

const reminderChannelSchema = z.enum(REMINDER_CHANNEL_VALUES, {
  errorMap: () => ({ message: "Canal do lembrete inválido." }),
});

const listAppointmentRemindersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  appointmentId: z.string().trim().min(1).optional(),
  status: reminderStatusSchema.optional(),
  channel: reminderChannelSchema.optional(),
});

const processAppointmentRemindersSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

function parseOrThrow(schema, payload) {
  const result = schema.safeParse(payload);

  if (!result.success) {
    throw new ValidationError(result.error);
  }

  return result.data;
}

export function validateListAppointmentRemindersQuery(payload) {
  return parseOrThrow(listAppointmentRemindersQuerySchema, payload);
}

export function validateProcessAppointmentReminders(payload) {
  return parseOrThrow(processAppointmentRemindersSchema, payload ?? {});
}
