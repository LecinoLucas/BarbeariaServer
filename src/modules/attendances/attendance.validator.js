import { z } from "zod";

import { ValidationError } from "../../errors/ValidationError.js";
import { ATTENDANCE_STATUS } from "../../constants/attendanceStatus.js";
import { PAYMENT_METHODS } from "../../constants/paymentMethods.js";

const statusValues = Object.values(ATTENDANCE_STATUS);
const paymentMethodValues = Object.values(PAYMENT_METHODS);
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const statusSchema = z.enum(statusValues, {
  errorMap: () => ({ message: "Status inválido." }),
});

const paymentMethodSchema = z.enum(paymentMethodValues, {
  errorMap: () => ({ message: "Método de pagamento inválido." }),
});

const finishPaymentActionSchema = z.enum(["PAID", "PENDING", "REGISTER_LATER"], {
  errorMap: () => ({ message: "Ação de pagamento inválida." }),
});

export const startAttendanceSchema = z.object({
  appointmentId: z
    .string({ required_error: "appointmentId é obrigatório." })
    .min(1, "appointmentId inválido."),
});

export const addAttendanceItemSchema = z.object({
  serviceId: z
    .string({ required_error: "serviceId é obrigatório." })
    .min(1, "serviceId inválido."),
  quantity: z.coerce
    .number({ required_error: "quantity é obrigatório." })
    .int("quantity deve ser inteiro.")
    .min(1, "quantity mínimo é 1."),
});

export const addAttendanceProductSchema = z.object({
  productId: z.string({ required_error: "productId é obrigatório." }).min(1, "productId inválido."),
  quantity: z.coerce.number({ required_error: "quantity é obrigatório." }).int("quantity deve ser inteiro.").min(1, "quantity mínimo é 1.").max(999, "quantity máximo é 999."),
});

export const updateAttendanceProductSchema = z.object({
  quantity: z.coerce.number({ required_error: "quantity é obrigatório." }).int("quantity deve ser inteiro.").min(1, "quantity mínimo é 1.").max(999, "quantity máximo é 999."),
});

export const listAttendancesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: statusSchema.optional(),
  clientId: z.string().optional(),
  professionalId: z.string().optional(),
  appointmentId: z.string().optional(),
  startDate: z.string().regex(dateRegex, "Data inicial inválida.").optional(),
  endDate: z.string().regex(dateRegex, "Data final inválida.").optional(),
  search: z.string().trim().optional(),
});

export const finishAttendanceWithPaymentSchema = z
  .object({
    paymentAction: finishPaymentActionSchema,
    paymentMethod: paymentMethodSchema.optional(),
    paymentMethodId: z.string().min(1, "paymentMethodId inválido.").optional(),
  })
  .superRefine((payload, ctx) => {
    if (payload.paymentAction === "PAID" && !payload.paymentMethod && !payload.paymentMethodId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "paymentMethod ou paymentMethodId é obrigatório para pagamento pago.",
        path: ["paymentMethodId"],
      });
    }
  });

function parseOrThrow(schema, payload) {
  const result = schema.safeParse(payload);
  if (!result.success) throw new ValidationError(result.error);
  return result.data;
}

export function validateStartAttendance(payload) {
  return parseOrThrow(startAttendanceSchema, payload);
}

export function validateAddAttendanceItem(payload) {
  return parseOrThrow(addAttendanceItemSchema, payload);
}

export function validateAddAttendanceProduct(payload) {
  return parseOrThrow(addAttendanceProductSchema, payload);
}

export function validateUpdateAttendanceProduct(payload) {
  return parseOrThrow(updateAttendanceProductSchema, payload);
}

export function validateListAttendancesQuery(payload) {
  return parseOrThrow(listAttendancesQuerySchema, payload);
}

export function validateFinishAttendanceWithPayment(payload) {
  return parseOrThrow(finishAttendanceWithPaymentSchema, payload);
}
