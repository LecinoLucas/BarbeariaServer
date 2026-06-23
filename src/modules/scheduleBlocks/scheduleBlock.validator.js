import { z } from "zod";
import { ValidationError } from "../../errors/ValidationError.js";

function normalizeOptionalString(value) {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }

  return value;
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

function parseOrThrow(schema, payload) {
  const result = schema.safeParse(payload);
  if (!result.success) throw new ValidationError(result.error);
  return result.data;
}

const dateStringRegex = /^\d{4}-\d{2}-\d{2}$/;

const idSchema = z
  .string({ required_error: "professionalId é obrigatório." })
  .trim()
  .min(1, "professionalId inválido.");

const titleSchema = z
  .string({ required_error: "title é obrigatório." })
  .trim()
  .min(2, "title deve ter no mínimo 2 caracteres.")
  .max(120, "title deve ter no máximo 120 caracteres.");

const reasonSchema = z
  .preprocess(normalizeOptionalString, z.string().trim().max(500).optional())
  .transform((value) => value ?? null);

const dateTimeSchema = (field) =>
  z
    .string({ required_error: `${field} é obrigatório.` })
    .datetime(`${field} inválido.`)
    .transform((value) => new Date(value));

const isActiveSchema = z.preprocess(coerceBoolean, z.boolean());

const createScheduleBlockSchema = z
  .object({
    professionalId: idSchema,
    title: titleSchema,
    reason: reasonSchema,
    startAt: dateTimeSchema("startAt"),
    endAt: dateTimeSchema("endAt"),
  })
  .superRefine((data, ctx) => {
    if (data.endAt <= data.startAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endAt"],
        message: "endAt deve ser maior que startAt.",
      });
    }
  });

const updateScheduleBlockSchema = z
  .object({
    title: titleSchema,
    reason: reasonSchema,
    startAt: dateTimeSchema("startAt"),
    endAt: dateTimeSchema("endAt"),
    isActive: isActiveSchema.default(true),
  })
  .superRefine((data, ctx) => {
    if (data.endAt <= data.startAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endAt"],
        message: "endAt deve ser maior que startAt.",
      });
    }
  });

const updateScheduleBlockStatusSchema = z.object({
  isActive: isActiveSchema,
});

const listScheduleBlocksQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  professionalId: z
    .preprocess(
      normalizeOptionalString,
      z.string().trim().min(1, "professionalId inválido.").optional(),
    )
    .transform((value) => value || undefined),
  startDate: z
    .preprocess(normalizeOptionalString, z.string().regex(dateStringRegex).optional())
    .transform((value) => value || undefined),
  endDate: z
    .preprocess(normalizeOptionalString, z.string().regex(dateStringRegex).optional())
    .transform((value) => value || undefined),
  isActive: z.preprocess(coerceBoolean, z.boolean().optional()),
});

export function validateCreateScheduleBlock(payload) {
  return parseOrThrow(createScheduleBlockSchema, payload);
}

export function validateUpdateScheduleBlock(payload) {
  return parseOrThrow(updateScheduleBlockSchema, payload);
}

export function validateUpdateScheduleBlockStatus(payload) {
  return parseOrThrow(updateScheduleBlockStatusSchema, payload);
}

export function validateListScheduleBlocksQuery(payload) {
  return parseOrThrow(listScheduleBlocksQuerySchema, payload);
}
