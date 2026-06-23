import { z } from "zod";
import { ValidationError } from "../../errors/ValidationError.js";

const codeSchema = z
  .string({ required_error: "code é obrigatório." })
  .min(1, "code inválido.")
  .max(50, "code deve ter no máximo 50 caracteres.")
  .regex(/^[A-Za-z0-9_]+$/, "code deve conter apenas letras, números e underscores.");

const createPaymentMethodSchema = z.object({
  code: codeSchema,
  name: z
    .string({ required_error: "name é obrigatório." })
    .trim()
    .min(1, "name inválido.")
    .max(100, "name deve ter no máximo 100 caracteres."),
  description: z
    .string()
    .trim()
    .max(255, "description deve ter no máximo 255 caracteres.")
    .optional()
    .nullable(),
  isActive: z.boolean().optional().default(true),
  displayOrder: z.number().int("displayOrder deve ser inteiro.").min(0).optional().default(0),
});

const updatePaymentMethodSchema = z.object({
  code: codeSchema.optional(),
  name: z
    .string({ required_error: "name é obrigatório." })
    .trim()
    .min(1, "name inválido.")
    .max(100, "name deve ter no máximo 100 caracteres.")
    .optional(),
  description: z
    .string()
    .trim()
    .max(255, "description deve ter no máximo 255 caracteres.")
    .optional()
    .nullable(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int("displayOrder deve ser inteiro.").min(0).optional(),
});

const listPaymentMethodsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  isActive: z
    .string()
    .optional()
    .transform((v) => {
      if (v === "true") return true;
      if (v === "false") return false;
      return undefined;
    }),
  search: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || undefined),
});

function parseOrThrow(schema, payload) {
  const result = schema.safeParse(payload);
  if (!result.success) throw new ValidationError(result.error);
  return result.data;
}

export function validateCreatePaymentMethod(payload) {
  return parseOrThrow(createPaymentMethodSchema, payload);
}

export function validateUpdatePaymentMethod(payload) {
  return parseOrThrow(updatePaymentMethodSchema, payload);
}

export function validateListPaymentMethodsQuery(payload) {
  return parseOrThrow(listPaymentMethodsQuerySchema, payload);
}
