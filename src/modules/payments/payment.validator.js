import { z } from "zod";

import { ValidationError } from "../../errors/ValidationError.js";
import { PAYMENT_METHODS } from "../../constants/paymentMethods.js";
import { PAYMENT_STATUS } from "../../constants/paymentStatus.js";

const statusValues = Object.values(PAYMENT_STATUS);
const methodValues = Object.values(PAYMENT_METHODS);
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const statusSchema = z.enum(statusValues, {
  errorMap: () => ({ message: "Status inválido." }),
});

const paymentMethodSchema = z.enum(methodValues, {
  errorMap: () => ({ message: "Método de pagamento inválido." }),
});

const optionalDate = (label) =>
  z.string().regex(dateRegex, `${label} inválida.`).optional();

export const createPaymentSchema = z.object({
  attendanceId: z
    .string({ required_error: "attendanceId é obrigatório." })
    .min(1, "attendanceId inválido."),
});

export const payPaymentSchema = z
  .object({
    paymentMethod: paymentMethodSchema.optional(),
    paymentMethodId: z.string().min(1).optional(),
  })
  .refine((data) => data.paymentMethod || data.paymentMethodId, {
    message: "paymentMethod ou paymentMethodId é obrigatório.",
    path: ["paymentMethod"],
  });

export const updateDiscountSchema = z.object({
  discount: z
    .number({ required_error: "discount é obrigatório.", invalid_type_error: "discount inválido." })
    .min(0, "discount deve ser maior ou igual a zero."),
});

export const listPaymentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: statusSchema.optional(),
  paymentMethod: paymentMethodSchema.optional(),
  paymentMethodId: z.string().min(1, "paymentMethodId inválido.").optional(),
  attendanceId: z.string().optional(),
  search: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined),
  startDate: optionalDate("Data inicial"),
  endDate: optionalDate("Data final"),
});

export const summaryQuerySchema = z.object({
  startDate: optionalDate("Data inicial"),
  endDate: optionalDate("Data final"),
});

function parseOrThrow(schema, payload) {
  const result = schema.safeParse(payload);
  if (!result.success) throw new ValidationError(result.error);
  return result.data;
}

export function validateCreatePayment(payload) {
  return parseOrThrow(createPaymentSchema, payload);
}

export function validatePayPayment(payload) {
  return parseOrThrow(payPaymentSchema, payload);
}

export function validateUpdateDiscount(payload) {
  return parseOrThrow(updateDiscountSchema, payload);
}

export function validateListPaymentsQuery(payload) {
  return parseOrThrow(listPaymentsQuerySchema, payload);
}

export function validateSummaryQuery(payload) {
  return parseOrThrow(summaryQuerySchema, payload);
}
