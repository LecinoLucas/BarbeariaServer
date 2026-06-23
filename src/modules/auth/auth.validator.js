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

export function validateLogin(payload) {
  const result = loginSchema.safeParse(payload);
  if (!result.success) throw new ValidationError(result.error);
  return result.data;
}
