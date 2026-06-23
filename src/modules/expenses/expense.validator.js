import { z } from "zod";

import { ValidationError } from "../../errors/ValidationError.js";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

function parseOrThrow(schema, payload) {
  const result = schema.safeParse(payload);
  if (!result.success) throw new ValidationError(result.error);
  return result.data;
}

export const createExpenseSchema = z.object({
  description: z
    .string({ required_error: "Descrição é obrigatória." })
    .trim()
    .min(1, "Descrição é obrigatória.")
    .max(255, "Descrição muito longa."),
  amountCents: z
    .number({ required_error: "Valor é obrigatório.", invalid_type_error: "Valor deve ser um número." })
    .int("Valor deve ser um inteiro em centavos.")
    .min(1, "Valor deve ser positivo."),
  category: z.string().trim().max(100, "Categoria muito longa.").optional().nullable(),
  expenseDate: z
    .string({ required_error: "Data é obrigatória." })
    .regex(dateRegex, "Data inválida."),
  notes: z.string().trim().max(1000, "Observação muito longa.").optional().nullable(),
});

export const updateExpenseSchema = createExpenseSchema;

export const listExpensesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  startDate: z.string().regex(dateRegex, "Data inicial inválida.").optional(),
  endDate: z.string().regex(dateRegex, "Data final inválida.").optional(),
  status: z.enum(["ACTIVE", "CANCELED"]).optional(),
  category: z.string().trim().max(100).optional(),
  search: z.string().trim().max(255).optional(),
});

export function validateCreateExpense(payload) {
  return parseOrThrow(createExpenseSchema, payload);
}

export function validateUpdateExpense(payload) {
  return parseOrThrow(updateExpenseSchema, payload);
}

export function validateListExpensesQuery(payload) {
  return parseOrThrow(listExpensesQuerySchema, payload);
}
