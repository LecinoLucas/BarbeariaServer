import { z } from "zod";

import { ValidationError } from "../../errors/ValidationError.js";

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

function normalizeOptionalString(value) {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }

  return value;
}

function minutesFromTime(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function coerceBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }

  return value;
}

const professionalIdSchema = z
  .string({ required_error: "professionalId é obrigatório." })
  .trim()
  .min(1, "professionalId inválido.");

const weekdaySchema = z.coerce
  .number({ invalid_type_error: "weekday inválido." })
  .int("weekday inválido.")
  .min(0, "weekday deve estar entre 0 e 6.")
  .max(6, "weekday deve estar entre 0 e 6.");

const timeSchema = (field) =>
  z
    .string({ required_error: `${field} é obrigatório.` })
    .regex(timeRegex, `${field} deve estar no formato HH:mm.`);

const isActiveSchema = z.preprocess(coerceBoolean, z.boolean());

const createProfessionalScheduleSchema = z
  .object({
    professionalId: professionalIdSchema,
    weekday: weekdaySchema,
    openTime: timeSchema("openTime"),
    closeTime: timeSchema("closeTime"),
    isActive: isActiveSchema.default(true),
  })
  .superRefine((data, ctx) => {
    if (minutesFromTime(data.closeTime) <= minutesFromTime(data.openTime)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["closeTime"],
        message: "closeTime deve ser maior que openTime.",
      });
    }
  });

const updateProfessionalScheduleSchema = z
  .object({
    weekday: weekdaySchema,
    openTime: timeSchema("openTime"),
    closeTime: timeSchema("closeTime"),
    isActive: isActiveSchema.default(true),
  })
  .superRefine((data, ctx) => {
    if (minutesFromTime(data.closeTime) <= minutesFromTime(data.openTime)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["closeTime"],
        message: "closeTime deve ser maior que openTime.",
      });
    }
  });

const updateProfessionalScheduleStatusSchema = z.object({
  isActive: isActiveSchema,
});

const listProfessionalSchedulesQuerySchema = z.object({
  professionalId: z
    .preprocess(
      normalizeOptionalString,
      z.string().trim().min(1, "professionalId inválido.").optional(),
    )
    .transform((value) => value || undefined),
  weekday: z.coerce.number().int().min(0).max(6).optional(),
  isActive: z.preprocess(coerceBoolean, z.boolean().optional()),
});

function parseOrThrow(schema, payload) {
  const result = schema.safeParse(payload);
  if (!result.success) throw new ValidationError(result.error);
  return result.data;
}

export function validateCreateProfessionalSchedule(payload) {
  return parseOrThrow(createProfessionalScheduleSchema, payload);
}

export function validateUpdateProfessionalSchedule(payload) {
  return parseOrThrow(updateProfessionalScheduleSchema, payload);
}

export function validateUpdateProfessionalScheduleStatus(payload) {
  return parseOrThrow(updateProfessionalScheduleStatusSchema, payload);
}

export function validateListProfessionalSchedulesQuery(payload) {
  return parseOrThrow(listProfessionalSchedulesQuerySchema, payload);
}
