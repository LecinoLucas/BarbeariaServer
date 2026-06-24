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

function optionalHttpUrl(fieldLabel, maxLength) {
  return z
    .string()
    .trim()
    .max(maxLength, `${fieldLabel} deve ter no máximo ${maxLength} caracteres.`)
    .optional()
    .nullable()
    .transform((value) => {
      if (typeof value !== "string") {
        return null;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    })
    .refine((value) => !value || /^https?:\/\//i.test(value), {
      message: `${fieldLabel} deve ser uma URL http(s) válida.`,
    });
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

  clientPortalEnabled: z.boolean({
    required_error: "clientPortalEnabled é obrigatório.",
    invalid_type_error: "clientPortalEnabled deve ser boolean.",
  }).optional().default(true),

  clientPortalSelfSignupEnabled: z.boolean({
    required_error: "clientPortalSelfSignupEnabled é obrigatório.",
    invalid_type_error: "clientPortalSelfSignupEnabled deve ser boolean.",
  }).optional().default(true),

  clientPortalRequireAdminApproval: z.boolean({
    required_error: "clientPortalRequireAdminApproval é obrigatório.",
    invalid_type_error: "clientPortalRequireAdminApproval deve ser boolean.",
  }).optional().default(false),

  clientPortalGoogleLoginEnabled: z.boolean({
    required_error: "clientPortalGoogleLoginEnabled é obrigatório.",
    invalid_type_error: "clientPortalGoogleLoginEnabled deve ser boolean.",
  }).optional().default(false),

  clientPortalBookingEnabled: z.boolean({
    required_error: "clientPortalBookingEnabled é obrigatório.",
    invalid_type_error: "clientPortalBookingEnabled deve ser boolean.",
  }).optional().default(true),

  clientPortalCancelEnabled: z.boolean({
    required_error: "clientPortalCancelEnabled é obrigatório.",
    invalid_type_error: "clientPortalCancelEnabled deve ser boolean.",
  }).optional().default(true),

  clientPortalCancelMinHours: z
    .number({
      required_error: "clientPortalCancelMinHours é obrigatório.",
      invalid_type_error: "clientPortalCancelMinHours inválido.",
    })
    .int()
    .min(0, "clientPortalCancelMinHours não pode ser negativo.")
    .max(720, "clientPortalCancelMinHours deve ser no máximo 720."),

  clientPortalShowPrices: z.boolean({
    required_error: "clientPortalShowPrices é obrigatório.",
    invalid_type_error: "clientPortalShowPrices deve ser boolean.",
  }).optional().default(true),

  clientPortalShowDuration: z.boolean({
    required_error: "clientPortalShowDuration é obrigatório.",
    invalid_type_error: "clientPortalShowDuration deve ser boolean.",
  }).optional().default(true),

  clientPortalShowProfessional: z.boolean({
    required_error: "clientPortalShowProfessional é obrigatório.",
    invalid_type_error: "clientPortalShowProfessional deve ser boolean.",
  }).optional().default(true),

  clientPortalSupportLabel: rejectUnsafeText("Texto do suporte", 80, { required: true }),
  clientPortalSupportUrl: optionalHttpUrl("Link do suporte", 500).transform((value) => value ?? ""),
  clientPortalBookingSuccessMessage: rejectUnsafeText("Mensagem de sucesso", 240, { required: true }),
  clientPortalNoSlotsMessage: rejectUnsafeText("Mensagem sem horários", 240, { required: true }),
  clientPortalBookingMinHoursAdvance: z
    .number({
      required_error: "clientPortalBookingMinHoursAdvance é obrigatório.",
      invalid_type_error: "clientPortalBookingMinHoursAdvance inválido.",
    })
    .int()
    .min(0, "clientPortalBookingMinHoursAdvance não pode ser negativo.")
    .max(720, "clientPortalBookingMinHoursAdvance deve ser no máximo 720."),
  clientPortalBookingMaxDaysAhead: z
    .number({
      required_error: "clientPortalBookingMaxDaysAhead é obrigatório.",
      invalid_type_error: "clientPortalBookingMaxDaysAhead inválido.",
    })
    .int()
    .min(0, "clientPortalBookingMaxDaysAhead não pode ser negativo.")
    .max(365, "clientPortalBookingMaxDaysAhead deve ser no máximo 365."),
  clientPortalMaxActiveAppointments: z
    .number({
      required_error: "clientPortalMaxActiveAppointments é obrigatório.",
      invalid_type_error: "clientPortalMaxActiveAppointments inválido.",
    })
    .int()
    .min(1, "clientPortalMaxActiveAppointments deve ser pelo menos 1.")
    .max(20, "clientPortalMaxActiveAppointments deve ser no máximo 20."),
  clientPortalNotesEnabled: z.boolean({
    required_error: "clientPortalNotesEnabled é obrigatório.",
    invalid_type_error: "clientPortalNotesEnabled deve ser boolean.",
  }).optional().default(true),
  clientPortalNotesRequired: z.boolean({
    required_error: "clientPortalNotesRequired é obrigatório.",
    invalid_type_error: "clientPortalNotesRequired deve ser boolean.",
  }).optional().default(false),
  clientPortalBookingInstruction: rejectUnsafeText("Texto de instrução", 240, { required: true }),
  clientPortalDashboardShowLastVisit: z.boolean({
    required_error: "clientPortalDashboardShowLastVisit é obrigatório.",
    invalid_type_error: "clientPortalDashboardShowLastVisit deve ser boolean.",
  }).optional().default(true),
  clientPortalDashboardShowTotalAppointments: z.boolean({
    required_error: "clientPortalDashboardShowTotalAppointments é obrigatório.",
    invalid_type_error: "clientPortalDashboardShowTotalAppointments deve ser boolean.",
  }).optional().default(true),
  clientPortalDashboardShowMonthCount: z.boolean({
    required_error: "clientPortalDashboardShowMonthCount é obrigatório.",
    invalid_type_error: "clientPortalDashboardShowMonthCount deve ser boolean.",
  }).optional().default(true),
  clientPortalDashboardShowNextAppointment: z.boolean({
    required_error: "clientPortalDashboardShowNextAppointment é obrigatório.",
    invalid_type_error: "clientPortalDashboardShowNextAppointment deve ser boolean.",
  }).optional().default(true),
  clientPortalDashboardShowRecentHistory: z.boolean({
    required_error: "clientPortalDashboardShowRecentHistory é obrigatório.",
    invalid_type_error: "clientPortalDashboardShowRecentHistory deve ser boolean.",
  }).optional().default(true),
  clientPortalDashboardHistoryLimit: z
    .number({
      required_error: "clientPortalDashboardHistoryLimit é obrigatório.",
      invalid_type_error: "clientPortalDashboardHistoryLimit inválido.",
    })
    .int()
    .min(1, "clientPortalDashboardHistoryLimit deve ser pelo menos 1.")
    .max(20, "clientPortalDashboardHistoryLimit deve ser no máximo 20."),
  clientPortalAppointmentsShowHistory: z.boolean({
    required_error: "clientPortalAppointmentsShowHistory é obrigatório.",
    invalid_type_error: "clientPortalAppointmentsShowHistory deve ser boolean.",
  }).optional().default(true),
  clientPortalAppointmentsHistoryLimit: z
    .number({
      required_error: "clientPortalAppointmentsHistoryLimit é obrigatório.",
      invalid_type_error: "clientPortalAppointmentsHistoryLimit inválido.",
    })
    .int()
    .min(1, "clientPortalAppointmentsHistoryLimit deve ser pelo menos 1.")
    .max(100, "clientPortalAppointmentsHistoryLimit deve ser no máximo 100."),
  clientPortalEmptyDashboardMessage: rejectUnsafeText("Mensagem vazia do dashboard", 240, {
    required: true,
  }),
  clientPortalEmptyAppointmentsMessage: rejectUnsafeText("Mensagem vazia dos agendamentos", 240, {
    required: true,
  }),

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
}).superRefine((value, ctx) => {
  if (!value.clientPortalNotesEnabled && value.clientPortalNotesRequired) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["clientPortalNotesRequired"],
      message: "Exigir observação só faz sentido quando a observação estiver habilitada.",
    });
  }
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
