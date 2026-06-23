import { z } from "zod";

import { ValidationError } from "../../errors/ValidationError.js";
import { ROLE_VALUES } from "../../constants/roles.js";
import { USER_STATUS } from "../../constants/userStatus.js";

const roleSchema = z.enum(ROLE_VALUES, {
  errorMap: () => ({ message: "Perfil inválido." }),
});

const statusSchema = z.enum([USER_STATUS.ACTIVE, USER_STATUS.INACTIVE], {
  errorMap: () => ({ message: "Status inválido." }),
});

const nameSchema = z
  .string({ required_error: "Nome é obrigatório." })
  .trim()
  .min(1, "Nome é obrigatório.");

const emailSchema = z
  .string({ required_error: "Email é obrigatório." })
  .trim()
  .min(1, "Email é obrigatório.")
  .email("Email inválido.");

const passwordSchema = z
  .string({ required_error: "Senha é obrigatória." })
  .min(6, "A senha deve ter no mínimo 6 caracteres.");

const createUserSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  role: roleSchema,
  status: statusSchema,
});

const updateUserSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  role: roleSchema,
  status: statusSchema,
});

const updateUserPasswordSchema = z.object({
  password: passwordSchema,
});

const updateUserStatusSchema = z.object({
  status: statusSchema,
});

const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined),
  role: roleSchema.optional(),
  status: statusSchema.optional(),
});

function parseOrThrow(schema, payload) {
  const result = schema.safeParse(payload);
  if (!result.success) throw new ValidationError(result.error);
  return result.data;
}

export function validateCreateUser(payload) {
  return parseOrThrow(createUserSchema, payload);
}

export function validateUpdateUser(payload) {
  return parseOrThrow(updateUserSchema, payload);
}

export function validateUpdateUserPassword(payload) {
  return parseOrThrow(updateUserPasswordSchema, payload);
}

export function validateUpdateUserStatus(payload) {
  return parseOrThrow(updateUserStatusSchema, payload);
}

export function validateListUsersQuery(payload) {
  return parseOrThrow(listUsersQuerySchema, payload);
}
