import { z } from "zod";
import { ValidationError } from "../../errors/ValidationError.js";

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

export const publicPortalSettingsSchema = z.object({
  enabled: z.boolean({
    required_error: "enabled é obrigatório.",
    invalid_type_error: "enabled deve ser boolean.",
  }),
  heroTitle: rejectUnsafeText("Título principal", 100, { required: true }),
  heroSubtitle: rejectUnsafeText("Subtítulo", 240),
  heroDescription: rejectUnsafeText("Descrição principal", 500),
  aboutTitle: rejectUnsafeText("Título sobre", 100),
  aboutText: rejectUnsafeText("Texto sobre", 2000),
  ctaLabel: rejectUnsafeText("Rótulo do CTA", 50, { required: true }),
  ctaUrl: optionalHttpUrl("URL do CTA", 500),
  whatsapp: rejectUnsafeText("WhatsApp", 20),
  instagram: optionalHttpUrl("Instagram", 120),
  address: rejectUnsafeText("Endereço", 500),
  openingHoursText: rejectUnsafeText("Horário de funcionamento", 500),
  showServicePrices: z.boolean({
    required_error: "showServicePrices é obrigatório.",
    invalid_type_error: "showServicePrices deve ser boolean.",
  }),
  showProductPrices: z.boolean({
    required_error: "showProductPrices é obrigatório.",
    invalid_type_error: "showProductPrices deve ser boolean.",
  }),
  heroImageUrl: optionalHttpUrl("URL da imagem principal", 500),
  logoUrl: optionalHttpUrl("URL do logotipo", 500),
});

export function validatePublicPortalSettings(payload) {
  const result = publicPortalSettingsSchema.safeParse(payload);
  if (!result.success) throw new ValidationError(result.error);
  return result.data;
}
