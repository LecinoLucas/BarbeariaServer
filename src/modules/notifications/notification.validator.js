import { z } from "zod";

import { ValidationError } from "../../errors/ValidationError.js";
import { NOTIFICATION_TYPES } from "../../constants/notificationTypes.js";

const notificationTypeValues = Object.values(NOTIFICATION_TYPES);

const notificationTypeSchema = z.enum(notificationTypeValues, {
  errorMap: () => ({ message: "Tipo de notificação inválido." }),
});

const createNotificationSchema = z.object({
  userId: z
    .string({ required_error: "userId é obrigatório." })
    .trim()
    .min(1, "userId é obrigatório."),
  title: z
    .string({ required_error: "Título é obrigatório." })
    .trim()
    .min(3, "Título deve ter no mínimo 3 caracteres.")
    .max(120, "Título deve ter no máximo 120 caracteres."),
  message: z
    .string({ required_error: "Mensagem é obrigatória." })
    .trim()
    .min(3, "Mensagem deve ter no mínimo 3 caracteres.")
    .max(500, "Mensagem deve ter no máximo 500 caracteres."),
  type: notificationTypeSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  read: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => {
      if (value === undefined) {
        return undefined;
      }

      return value === "true";
    }),
  type: notificationTypeSchema.optional(),
});

function parseOrThrow(schema, payload) {
  const result = schema.safeParse(payload);
  if (!result.success) throw new ValidationError(result.error);
  return result.data;
}

export function validateCreateNotification(payload) {
  return parseOrThrow(createNotificationSchema, payload);
}

export function validateListNotificationsQuery(payload) {
  return parseOrThrow(listNotificationsQuerySchema, payload);
}
