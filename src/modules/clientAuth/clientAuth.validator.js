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

const signupSchema = z
  .object({
    name: z
      .string({ required_error: "Nome é obrigatório." })
      .trim()
      .min(1, "Nome é obrigatório."),
    phone: z
      .string({ required_error: "Telefone é obrigatório." })
      .trim()
      .min(1, "Telefone é obrigatório."),
    email: z
      .string({ required_error: "Email é obrigatório." })
      .trim()
      .min(1, "Email é obrigatório.")
      .email("Email inválido.")
      .transform((value) => value.toLowerCase()),
    password: z
      .string({ required_error: "Senha é obrigatória." })
      .min(6, "A senha deve ter no mínimo 6 caracteres."),
    confirmPassword: z
      .string({ required_error: "Confirmação de senha é obrigatória." })
      .min(6, "A confirmação de senha deve ter no mínimo 6 caracteres."),
  })
  .superRefine((value, ctx) => {
    if (value.password !== value.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "A confirmação de senha deve ser igual à senha.",
      });
    }
  });

const googleSchema = z.object({
  credential: z
    .string({ required_error: "Credencial do Google é obrigatória." })
    .trim()
    .min(1, "Credencial do Google é obrigatória."),
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

export function validateClientAuthSignup(payload) {
  return parseOrThrow(signupSchema, payload);
}

export function validateClientAuthGoogle(payload) {
  return parseOrThrow(googleSchema, payload);
}
