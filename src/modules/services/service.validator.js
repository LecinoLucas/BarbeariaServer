import { z } from "zod";

import { ValidationError } from "../../errors/ValidationError.js";
import { SERVICE_STATUS } from "../../constants/serviceStatus.js";

const statusSchema = z.enum([SERVICE_STATUS.ACTIVE, SERVICE_STATUS.INACTIVE], {
  errorMap: () => ({ message: "Status inválido." }),
});

function normalizeOptionalString(value) {
  if (value === "" || value === null || value === undefined) return undefined;
  return value;
}

const createServiceSchema = z.object({
  name: z
    .string({ required_error: "Nome é obrigatório." })
    .trim()
    .min(3, "Nome deve ter no mínimo 3 caracteres.")
    .max(120, "Nome deve ter no máximo 120 caracteres."),
  description: z.preprocess(
    normalizeOptionalString,
    z.string().trim().max(500, "Descrição deve ter no máximo 500 caracteres.").optional(),
  ).transform((value) => value ?? null),
  price: z
    .number({ required_error: "Preço é obrigatório.", invalid_type_error: "Preço inválido." })
    .positive("Preço deve ser maior que zero."),
  durationMinutes: z
    .number({
      required_error: "Duração é obrigatória.",
      invalid_type_error: "Duração inválida.",
    })
    .int("Duração deve ser um número inteiro.")
    .positive("Duração deve ser maior que zero.")
    .max(480, "Duração deve ser no máximo 480 minutos."),
  status: statusSchema.default(SERVICE_STATUS.ACTIVE),
});

const updateServiceSchema = z.object({
  name: z
    .string({ required_error: "Nome é obrigatório." })
    .trim()
    .min(3, "Nome deve ter no mínimo 3 caracteres.")
    .max(120, "Nome deve ter no máximo 120 caracteres."),
  description: z.preprocess(
    normalizeOptionalString,
    z.string().trim().max(500, "Descrição deve ter no máximo 500 caracteres.").optional(),
  ).transform((value) => value ?? null),
  price: z
    .number({ required_error: "Preço é obrigatório.", invalid_type_error: "Preço inválido." })
    .positive("Preço deve ser maior que zero."),
  durationMinutes: z
    .number({
      required_error: "Duração é obrigatória.",
      invalid_type_error: "Duração inválida.",
    })
    .int("Duração deve ser um número inteiro.")
    .positive("Duração deve ser maior que zero.")
    .max(480, "Duração deve ser no máximo 480 minutos."),
  status: statusSchema,
});

const updateServiceStatusSchema = z.object({
  status: statusSchema,
});

const listServicesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined),
  status: statusSchema.optional(),
});

function parseOrThrow(schema, payload) {
  const result = schema.safeParse(payload);
  if (!result.success) throw new ValidationError(result.error);
  return result.data;
}

export function validateCreateService(payload) {
  return parseOrThrow(createServiceSchema, payload);
}

export function validateUpdateService(payload) {
  return parseOrThrow(updateServiceSchema, payload);
}

export function validateUpdateServiceStatus(payload) {
  return parseOrThrow(updateServiceStatusSchema, payload);
}

export function validateListServicesQuery(payload) {
  return parseOrThrow(listServicesQuerySchema, payload);
}
