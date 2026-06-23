import { z } from "zod";

import { ValidationError } from "../../errors/ValidationError.js";
import { USER_STATUS } from "../../constants/userStatus.js";

const statusSchema = z.enum([USER_STATUS.ACTIVE, USER_STATUS.INACTIVE], {
  errorMap: () => ({ message: "Status inválido." }),
});

function normalizeOptionalString(value) {
  if (value === "") {
    return undefined;
  }

  return value;
}

function isValidDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const nameSchema = z
  .string({ required_error: "Nome é obrigatório." })
  .trim()
  .min(1, "Nome é obrigatório.");

const phoneSchema = z
  .string({ required_error: "Telefone é obrigatório." })
  .trim()
  .min(1, "Telefone é obrigatório.");

const optionalEmailSchema = z.preprocess(
  normalizeOptionalString,
  z
    .union([
      z.string().trim().email("Email inválido."),
      z.null(),
    ])
    .optional(),
).transform((value) => {
  if (!value) {
    return null;
  }

  return value.toLowerCase();
});

const optionalNotesSchema = z.preprocess(
  normalizeOptionalString,
  z.union([z.string().trim(), z.null()]).optional(),
).transform((value) => value ?? null);

const optionalBirthDateSchema = z.preprocess(
  normalizeOptionalString,
  z.union([z.string(), z.null()]).optional(),
).superRefine((value, ctx) => {
  if (value === undefined || value === null) {
    return;
  }

  if (!isValidDateString(value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Data de nascimento inválida.",
    });
  }
}).transform((value) => {
  if (!value) {
    return null;
  }

  return new Date(`${value}T00:00:00.000Z`);
});

const createClientSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
  email: optionalEmailSchema,
  birthDate: optionalBirthDateSchema,
  notes: optionalNotesSchema,
  status: statusSchema.default(USER_STATUS.ACTIVE),
});

const updateClientSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
  email: optionalEmailSchema,
  birthDate: optionalBirthDateSchema,
  notes: optionalNotesSchema,
  status: statusSchema,
});

const updateClientStatusSchema = z.object({
  status: statusSchema,
});

const listClientsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined),
  status: statusSchema.optional(),
  birthMonth: z.coerce.number().int().min(1).max(12).optional(),
});

const birthdaysQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
});

const topActiveClientsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

function parseOrThrow(schema, payload) {
  const result = schema.safeParse(payload);
  if (!result.success) throw new ValidationError(result.error);
  return result.data;
}

export function validateCreateClient(payload) {
  return parseOrThrow(createClientSchema, payload);
}

export function validateUpdateClient(payload) {
  return parseOrThrow(updateClientSchema, payload);
}

export function validateUpdateClientStatus(payload) {
  return parseOrThrow(updateClientStatusSchema, payload);
}

export function validateListClientsQuery(payload) {
  return parseOrThrow(listClientsQuerySchema, payload);
}

export function validateBirthdaysQuery(payload) {
  return parseOrThrow(birthdaysQuerySchema, payload);
}

export function validateTopActiveClientsQuery(payload) {
  return parseOrThrow(topActiveClientsQuerySchema, payload);
}
