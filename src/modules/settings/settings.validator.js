import { z } from "zod";

import { ValidationError } from "../../errors/ValidationError.js";
import { normalizeReceiptTemplate } from "./settings.service.js";

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
const htmlLikeRegex = /<[^>]+>/;
const dangerousScriptRegex = /<\s*script\b|javascript:/i;

function rejectUnsafeText(fieldLabel, maxLength, { required = false } = {}) {
  let schema = z.string().trim();

  if (required) {
    schema = schema
      .min(1, `${fieldLabel} é obrigatório.`)
      .max(maxLength, `${fieldLabel} deve ter no máximo ${maxLength} caracteres.`);
  } else {
    schema = schema
      .max(maxLength, `${fieldLabel} deve ter no máximo ${maxLength} caracteres.`)
      .optional()
      .nullable()
      .transform((value) => {
        if (typeof value !== "string") {
          return null;
        }

        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
      });
  }

  return schema.refine(
    (value) => {
      if (!value) return true;
      return !htmlLikeRegex.test(value) && !dangerousScriptRegex.test(value);
    },
    `${fieldLabel} não pode conter HTML ou script.`,
  );
}

const internalAssetPathRegex = /^\/login-appearance-assets\/[a-z0-9][a-z0-9._-]*$/i;
const externalHttpUrlSchema = z.string().url().refine((value) => /^https?:\/\//i.test(value), {
  message: "backgroundImageUrl deve ser uma URL http(s) válida.",
});
const canonicalReceiptTemplateValues = ["classic", "clean_compact"];
const legacyReceiptTemplateAliases = new Set([
  "classic",
  "model_1",
  "modelo_1",
  "1",
  "clean_compact",
  "clean-compact",
  "model_2",
  "modelo_2",
  "2",
]);

export const settingsSchema = z.object({
  barbershopName: z
    .string({ required_error: "Nome é obrigatório." })
    .min(2, "Nome deve ter pelo menos 2 caracteres.")
    .max(120, "Nome deve ter no máximo 120 caracteres."),

  phone: z.string().max(20, "Telefone deve ter no máximo 20 caracteres.").optional().default(""),
  whatsapp: z.string().max(20, "WhatsApp deve ter no máximo 20 caracteres.").optional().default(""),
  instagram: z.string().max(120, "Instagram deve ter no máximo 120 caracteres.").optional().default(""),

  email: z
    .string()
    .optional()
    .default("")
    .refine(
      (v) => !v || z.string().email().safeParse(v).success,
      "E-mail inválido."
    ),

  address: z
    .object({
      street: z.string().max(200).optional().default(""),
      number: z.string().max(20).optional().default(""),
      district: z.string().max(100).optional().default(""),
      city: z.string().max(100).optional().default(""),
      state: z.string().max(2).optional().default(""),
      zipcode: z.string().max(20).optional().default(""),
    })
    .optional()
    .default({}),

  appointmentReminderEnabled: z.boolean({
    required_error: "appointmentReminderEnabled é obrigatório.",
    invalid_type_error: "appointmentReminderEnabled deve ser boolean.",
  }).optional().default(true),

  appointmentReminderEmailEnabled: z.boolean({
    required_error: "appointmentReminderEmailEnabled é obrigatório.",
    invalid_type_error: "appointmentReminderEmailEnabled deve ser boolean.",
  }).optional().default(false),

  appointmentReminderMinutes: z
    .number({ required_error: "appointmentReminderMinutes é obrigatório.", invalid_type_error: "appointmentReminderMinutes inválido." })
    .int()
    .min(1, "Mínimo de 1 minuto.")
    .max(180, "Máximo de 180 minutos."),

  defaultOpenTime: z
    .string({ required_error: "defaultOpenTime é obrigatório." })
    .regex(timeRegex, "defaultOpenTime inválido. Use o formato HH:mm."),

  defaultCloseTime: z
    .string({ required_error: "defaultCloseTime é obrigatório." })
    .regex(timeRegex, "defaultCloseTime inválido. Use o formato HH:mm."),

  appointmentIntervalMinutes: z
    .number({ required_error: "appointmentIntervalMinutes é obrigatório.", invalid_type_error: "appointmentIntervalMinutes inválido." })
    .int()
    .min(1, "Mínimo de 1 minuto.")
    .max(120, "Máximo de 120 minutos."),

  allowClientCancel: z.boolean({ required_error: "allowClientCancel é obrigatório.", invalid_type_error: "allowClientCancel deve ser boolean." }),
  allowClientReschedule: z.boolean({ required_error: "allowClientReschedule é obrigatório.", invalid_type_error: "allowClientReschedule deve ser boolean." }),

  receiptTemplate: z.preprocess(
    (value) => {
      if (typeof value !== "string") {
        return value;
      }

      const raw = value.trim().toLowerCase();
      if (!legacyReceiptTemplateAliases.has(raw)) {
        return value;
      }

      return normalizeReceiptTemplate(raw);
    },
    z.enum(canonicalReceiptTemplateValues).optional().default("classic"),
  ),
});

export const loginAppearanceSchema = z.object({
  heroTitle: rejectUnsafeText("Texto principal", 100, { required: true }),
  heroSubtitle: rejectUnsafeText("Subtítulo", 240),
  heroEyebrow: rejectUnsafeText("Texto de destaque", 60),
  loginButtonText: rejectUnsafeText("Texto do botão", 40),
  backgroundImageAlt: rejectUnsafeText("Texto alternativo da imagem", 120),
  backgroundImageUrl: z.preprocess(
    (value) => {
      if (typeof value !== "string") {
        return value ?? null;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    },
    z
      .union([
        externalHttpUrlSchema,
        z.string().regex(internalAssetPathRegex, "backgroundImageUrl inválida."),
      ])
      .nullable()
      .optional(),
  ),
});

function parseOrThrow(schema, payload) {
  const result = schema.safeParse(payload);
  if (!result.success) throw new ValidationError(result.error);
  return result.data;
}

export function validateSettings(payload) {
  return parseOrThrow(settingsSchema, payload);
}

export function validateLoginAppearance(payload) {
  return parseOrThrow(loginAppearanceSchema, payload);
}
