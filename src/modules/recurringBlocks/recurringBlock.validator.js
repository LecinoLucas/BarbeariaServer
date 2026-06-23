import { z } from "zod";
import { ValidationError } from "../../errors/ValidationError.js";

const timeRegex = /^([0-1]\d|2[0-3]):([0-5]\d)$/;

function parseOrThrow(schema, payload) {
  const result = schema.safeParse(payload);
  if (!result.success) throw new ValidationError(result.error);
  return result.data;
}

function normalizeOptionalString(value) {
  if (value === "" || value === null || value === undefined) return undefined;
  return value;
}

function coerceBoolean(value) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}

function timeToMinutes(time) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

const timeSchema = (field) =>
  z
    .string({ required_error: `${field} é obrigatório.` })
    .regex(timeRegex, `${field} inválido. Use o formato HH:mm.`);

const reasonSchema = z
  .preprocess(normalizeOptionalString, z.string().trim().max(500).optional())
  .transform((v) => v ?? null);

const dayOfWeekSchema = (required_error) =>
  z.coerce
    .number({ required_error })
    .int("dayOfWeek deve ser um número inteiro.")
    .min(0, "dayOfWeek deve ser entre 0 (domingo) e 6 (sábado).")
    .max(6, "dayOfWeek deve ser entre 0 (domingo) e 6 (sábado).");

const createRecurringBlockSchema = z
  .object({
    professionalId: z
      .string({ required_error: "professionalId é obrigatório." })
      .trim()
      .min(1, "professionalId inválido."),
    dayOfWeek: dayOfWeekSchema("dayOfWeek é obrigatório."),
    startTime: timeSchema("startTime"),
    endTime: timeSchema("endTime"),
    reason: reasonSchema,
  })
  .superRefine((data, ctx) => {
    if (timeToMinutes(data.endTime) <= timeToMinutes(data.startTime)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endTime"],
        message: "endTime deve ser maior que startTime.",
      });
    }
  });

const updateRecurringBlockSchema = z
  .object({
    dayOfWeek: dayOfWeekSchema("dayOfWeek é obrigatório."),
    startTime: timeSchema("startTime"),
    endTime: timeSchema("endTime"),
    reason: reasonSchema,
    isActive: z.preprocess(coerceBoolean, z.boolean().default(true)),
  })
  .superRefine((data, ctx) => {
    if (timeToMinutes(data.endTime) <= timeToMinutes(data.startTime)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endTime"],
        message: "endTime deve ser maior que startTime.",
      });
    }
  });

const listRecurringBlocksQuerySchema = z.object({
  professionalId: z
    .preprocess(normalizeOptionalString, z.string().trim().min(1).optional())
    .transform((v) => v || undefined),
  dayOfWeek: z.coerce.number().int().min(0).max(6).optional(),
  isActive: z.preprocess(coerceBoolean, z.boolean().optional()),
});

export function validateCreateRecurringBlock(payload) {
  return parseOrThrow(createRecurringBlockSchema, payload);
}

export function validateUpdateRecurringBlock(payload) {
  return parseOrThrow(updateRecurringBlockSchema, payload);
}

export function validateListRecurringBlocksQuery(payload) {
  return parseOrThrow(listRecurringBlocksQuerySchema, payload);
}
