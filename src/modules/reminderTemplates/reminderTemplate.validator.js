import { z } from "zod";

import { REMINDER_TEMPLATE_CHANNEL_VALUES } from "../../constants/reminderTemplateChannel.js";
import { REMINDER_TEMPLATE_TYPE_VALUES } from "../../constants/reminderTemplateType.js";
import { ValidationError } from "../../errors/ValidationError.js";

const reminderTemplateTypeSchema = z.enum(REMINDER_TEMPLATE_TYPE_VALUES, {
  errorMap: () => ({ message: "Tipo de template inválido." }),
});

const reminderTemplateChannelSchema = z.enum(REMINDER_TEMPLATE_CHANNEL_VALUES, {
  errorMap: () => ({ message: "Canal de template inválido." }),
});

const optionalTrimmedTextSchema = z
  .string()
  .optional()
  .nullable()
  .transform((value) => {
    if (typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim();
    return trimmed || null;
  });

const reminderTemplateBodyHtmlSchema = z
  .string()
  .max(6000, "bodyHtml deve ter no máximo 6000 caracteres.")
  .optional()
  .nullable();

const reminderTemplateCreateSchema = z.object({
  type: reminderTemplateTypeSchema,
  channel: reminderTemplateChannelSchema,
  name: z
    .string({ required_error: "name é obrigatório." })
    .trim()
    .min(1, "name inválido.")
    .max(100, "name deve ter no máximo 100 caracteres."),
  subject: optionalTrimmedTextSchema
    .pipe(
      z
        .string()
        .max(120, "subject deve ter no máximo 120 caracteres.")
        .optional()
        .nullable(),
    ),
  bodyText: z
    .string({ required_error: "bodyText é obrigatório." })
    .max(3000, "bodyText deve ter no máximo 3000 caracteres."),
  bodyHtml: reminderTemplateBodyHtmlSchema,
  isActive: z.boolean().optional().default(false),
});

const reminderTemplateUpdateSchema = z.object({
  type: reminderTemplateTypeSchema,
  channel: reminderTemplateChannelSchema,
  name: z
    .string({ required_error: "name é obrigatório." })
    .trim()
    .min(1, "name inválido.")
    .max(100, "name deve ter no máximo 100 caracteres."),
  subject: optionalTrimmedTextSchema
    .pipe(
      z
        .string()
        .max(120, "subject deve ter no máximo 120 caracteres.")
        .optional()
        .nullable(),
    ),
  bodyText: z
    .string({ required_error: "bodyText é obrigatório." })
    .max(3000, "bodyText deve ter no máximo 3000 caracteres."),
  bodyHtml: reminderTemplateBodyHtmlSchema,
  isActive: z.boolean().optional(),
});

const reminderTemplateEmailPreviewSchema = z.object({
  templateId: z.string().trim().min(1).optional(),
  type: reminderTemplateTypeSchema,
  channel: reminderTemplateChannelSchema,
  subject: optionalTrimmedTextSchema
    .pipe(
      z
        .string()
        .max(120, "subject deve ter no máximo 120 caracteres.")
        .optional()
        .nullable(),
    )
    .optional(),
  bodyText: z
    .string()
    .max(3000, "bodyText deve ter no máximo 3000 caracteres.")
    .optional(),
  bodyHtml: reminderTemplateBodyHtmlSchema.optional(),
});

const reminderTemplateEmailTestSchema = z.object({
  to: z
    .string({ required_error: "to é obrigatório." })
    .trim()
    .email("Informe um e-mail válido."),
  templateId: z.string().trim().min(1).optional(),
  type: reminderTemplateTypeSchema,
  channel: reminderTemplateChannelSchema,
});

const listReminderTemplatesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  type: reminderTemplateTypeSchema.optional(),
  channel: reminderTemplateChannelSchema.optional(),
  isActive: z
    .string()
    .optional()
    .transform((value) => {
      if (value === "true") return true;
      if (value === "false") return false;
      return undefined;
    }),
});

function parseOrThrow(schema, payload) {
  const result = schema.safeParse(payload);

  if (!result.success) {
    throw new ValidationError(result.error);
  }

  return result.data;
}

export function validateListReminderTemplatesQuery(payload) {
  return parseOrThrow(listReminderTemplatesQuerySchema, payload);
}

export function validateCreateReminderTemplate(payload) {
  return parseOrThrow(reminderTemplateCreateSchema, payload);
}

export function validateUpdateReminderTemplate(payload) {
  return parseOrThrow(reminderTemplateUpdateSchema, payload);
}

export function validatePreviewReminderTemplateEmail(payload) {
  return parseOrThrow(reminderTemplateEmailPreviewSchema, payload);
}

export function validateSendReminderTemplateTestEmail(payload) {
  return parseOrThrow(reminderTemplateEmailTestSchema, payload);
}
