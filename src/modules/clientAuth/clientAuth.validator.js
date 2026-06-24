import { z } from "zod";

import { ValidationError } from "../../errors/ValidationError.js";

const loginSchema = z.object({
  email: z
    .string({ required_error: "Email é obrigatório." })
    .trim()
    .min(1, "Email é obrigatório.")
    .email("Email inválido."),
  password: z
    .string({ required_error: "Senha é obrigatória." })
    .min(6, "A senha deve ter no mínimo 6 caracteres."),
});

const changePasswordSchema = z.object({
  currentPassword: z
    .string({ required_error: "Senha atual é obrigatória." })
    .min(6, "A senha atual deve ter no mínimo 6 caracteres."),
  newPassword: z
    .string({ required_error: "Nova senha é obrigatória." })
    .min(6, "A nova senha deve ter no mínimo 6 caracteres."),
});

function parseOrThrow(schema, payload) {
  const result = schema.safeParse(payload);

  if (!result.success) {
    throw new ValidationError(result.error);
  }

  return result.data;
}

export function validateClientAuthLogin(payload) {
  return parseOrThrow(loginSchema, payload);
}

export function validateClientAuthPassword(payload) {
  return parseOrThrow(changePasswordSchema, payload);
}
