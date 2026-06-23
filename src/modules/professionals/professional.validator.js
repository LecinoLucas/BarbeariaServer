import { z } from "zod";

import { ValidationError } from "../../errors/ValidationError.js";
import { USER_STATUS } from "../../constants/userStatus.js";

const statusSchema = z.enum([USER_STATUS.ACTIVE, USER_STATUS.INACTIVE], {
  errorMap: () => ({ message: "Status inválido." }),
});

function normalizeOptionalString(value) {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }

  return value;
}

const nameSchema = z
  .string({ required_error: "Nome é obrigatório." })
  .trim()
  .min(1, "Nome é obrigatório.");

const optionalUserIdSchema = z.preprocess(
  normalizeOptionalString,
  z.string().trim().min(1, "userId inválido.").optional(),
).transform((value) => value ?? null);

const optionalPhoneSchema = z.preprocess(
  normalizeOptionalString,
  z.string().trim().min(1, "Telefone inválido.").optional(),
).transform((value) => value ?? null);

const optionalSpecialtySchema = z.preprocess(
  normalizeOptionalString,
  z.string().trim().min(1, "Especialidade inválida.").optional(),
).transform((value) => value ?? null);

// "" | null | undefined → null; valid positive integer → number; else validation error
const optionalAppointmentIntervalSchema = z.preprocess(
  (value) => {
    if (value === "" || value === null || value === undefined) return null;
    const coerced = Number(value);
    return Number.isNaN(coerced) ? value : coerced;
  },
  z
    .union([
      z.null(),
      z
        .number({ invalid_type_error: "O intervalo deve ser um número inteiro." })
        .int("O intervalo deve ser um número inteiro.")
        .min(1, "O intervalo deve ser maior que zero.")
        .max(480, "O intervalo não pode ultrapassar 480 minutos."),
    ]),
);

const createProfessionalSchema = z.object({
  userId: optionalUserIdSchema,
  name: nameSchema,
  phone: optionalPhoneSchema,
  specialty: optionalSpecialtySchema,
  appointmentIntervalMinutes: optionalAppointmentIntervalSchema.optional().default(null),
  status: statusSchema.default(USER_STATUS.ACTIVE),
});

const updateProfessionalSchema = z.object({
  userId: optionalUserIdSchema,
  name: nameSchema,
  phone: optionalPhoneSchema,
  specialty: optionalSpecialtySchema,
  appointmentIntervalMinutes: optionalAppointmentIntervalSchema.optional(),
  status: statusSchema,
});

const updateProfessionalStatusSchema = z.object({
  status: statusSchema,
});

const listProfessionalsQuerySchema = z.object({
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

export function validateCreateProfessional(payload) {
  return parseOrThrow(createProfessionalSchema, payload);
}

export function validateUpdateProfessional(payload) {
  return parseOrThrow(updateProfessionalSchema, payload);
}

export function validateUpdateProfessionalStatus(payload) {
  return parseOrThrow(updateProfessionalStatusSchema, payload);
}

export function validateListProfessionalsQuery(payload) {
  return parseOrThrow(listProfessionalsQuerySchema, payload);
}
