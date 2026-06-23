import { REMINDER_CHANNELS } from "../../constants/reminderChannel.js";
import { REMINDER_TEMPLATE_CHANNELS } from "../../constants/reminderTemplateChannel.js";
import { ROLES } from "../../constants/roles.js";
import { env } from "../../config/env.js";
import { BadRequestError } from "../../errors/BadRequestError.js";
import { ForbiddenError } from "../../errors/ForbiddenError.js";
import { NotFoundError } from "../../errors/NotFoundError.js";
import { createEmailProvider } from "../../providers/email/emailProviderFactory.js";
import { EmailProviderError } from "../../providers/email/emailProvider.js";
import {
  createReminderTemplate as repoCreateReminderTemplate,
  createReminderTemplateWithActivation,
  activateReminderTemplate as repoActivateReminderTemplate,
  countReminderTemplates,
  deactivateReminderTemplate as repoDeactivateReminderTemplate,
  findActiveReminderTemplate,
  findReminderTemplateById,
  listReminderTemplates as repoListReminderTemplates,
  updateReminderTemplate as repoUpdateReminderTemplate,
  updateReminderTemplateWithActivation,
} from "./reminderTemplate.repository.js";
import { buildAppointmentReminderEmailTemplate } from "../appointmentReminders/templates/appointmentReminderEmail.template.js";
import { REMINDER_TEMPLATE_TYPES } from "../../constants/reminderTemplateType.js";

const NOT_FOUND_MESSAGE = "Template de lembrete não encontrado.";
const DEFAULT_VALUE = "-";
const DEFAULT_BARBERSHOP_NAME = "Alphamen Barbearia";
const PLACEHOLDER_REGEX = /{([^{}]+)}/g;
const SINGLE_EMAIL_REGEX = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;
const UNSAFE_HTML_PATTERNS = [
  /<\s*(script|iframe|object|embed)\b/i,
  /\son[a-z]+\s*=/i,
  /javascript\s*:/i,
  /vbscript\s*:/i,
  /srcdoc\s*=/i,
];

export const REMINDER_TEMPLATE_ALLOWED_PLACEHOLDERS = Object.freeze([
  "{cliente}",
  "{profissional}",
  "{servico}",
  "{data}",
  "{hora}",
  "{barbearia}",
  "{duracao}",
  "{preco}",
  "{link}",
]);

const REMINDER_TEMPLATE_ALLOWED_PLACEHOLDER_MAP = Object.freeze(
  Object.fromEntries(
    REMINDER_TEMPLATE_ALLOWED_PLACEHOLDERS.map((placeholder) => [
      placeholder.slice(1, -1),
      placeholder,
    ]),
  ),
);

const EMAIL_TEST_SAMPLE_CONTEXT = Object.freeze({
  appPublicUrl: null,
  appointment: {
    client: {
      name: "João Silva",
    },
    professional: {
      name: "Carlos Mendes",
    },
    service: {
      name: "Corte Masculino",
      durationMinutes: 45,
      price: "50.00",
    },
    startAt: new Date("2026-06-22T14:30:00-03:00"),
  },
  barbershopName: DEFAULT_BARBERSHOP_NAME,
});

function ensureAdminActor(actor) {
  if (!actor || actor.role !== ROLES.ADMIN) {
    throw new ForbiddenError("Acesso negado.");
  }
}

function ensureEmailReminderTypeAndChannel(type, channel) {
  if (
    type !== REMINDER_TEMPLATE_TYPES.APPOINTMENT_REMINDER ||
    channel !== REMINDER_TEMPLATE_CHANNELS.EMAIL
  ) {
    throw new BadRequestError("Tipo ou canal de template não suportado para esta ação.");
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeMultilineText(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .trim();
}

function extractPlaceholders(...contents) {
  const found = new Set();

  for (const content of contents) {
    if (typeof content !== "string" || !content) {
      continue;
    }

    for (const match of content.matchAll(PLACEHOLDER_REGEX)) {
      found.add(`{${match[1]}}`);
    }
  }

  return Array.from(found);
}

function findUnknownPlaceholders(...contents) {
  return extractPlaceholders(...contents).filter(
    (placeholder) => !REMINDER_TEMPLATE_ALLOWED_PLACEHOLDERS.includes(placeholder),
  );
}

function ensureSafeHtml(bodyHtml) {
  if (!bodyHtml) {
    return;
  }

  if (UNSAFE_HTML_PATTERNS.some((pattern) => pattern.test(bodyHtml))) {
    throw new BadRequestError("bodyHtml contém conteúdo HTML não permitido.");
  }
}

function normalizeReminderTemplatePayload(payload) {
  return {
    type: payload.type,
    channel: payload.channel,
    name: payload.name.trim(),
    subject: payload.subject ? normalizeMultilineText(payload.subject) : null,
    bodyText: normalizeMultilineText(payload.bodyText),
    bodyHtml: payload.bodyHtml ? normalizeMultilineText(payload.bodyHtml) : null,
    isActive: Boolean(payload.isActive),
  };
}

function validateReminderTemplatePayload(payload) {
  const normalized = normalizeReminderTemplatePayload(payload);

  if (!normalized.bodyText) {
    throw new BadRequestError("bodyText é obrigatório.");
  }

  if (
    normalized.channel === REMINDER_TEMPLATE_CHANNELS.EMAIL &&
    !normalized.subject
  ) {
    throw new BadRequestError("subject é obrigatório para templates de e-mail.");
  }

  const unknownPlaceholders = findUnknownPlaceholders(
    normalized.subject,
    normalized.bodyText,
    normalized.bodyHtml,
  );

  if (unknownPlaceholders.length > 0) {
    throw new BadRequestError(
      `Template contém placeholders inválidos: ${unknownPlaceholders.join(", ")}.`,
    );
  }

  ensureSafeHtml(normalized.bodyHtml);

  return normalized;
}

function formatDate(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return DEFAULT_VALUE;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

function formatTime(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return DEFAULT_VALUE;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatPrice(value) {
  const numeric = Number.parseFloat(String(value ?? ""));

  if (!Number.isFinite(numeric)) {
    return DEFAULT_VALUE;
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(numeric);
}

function formatDuration(value) {
  const minutes = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isInteger(minutes) || minutes <= 0) {
    return DEFAULT_VALUE;
  }

  return `${minutes} min`;
}

function normalizeValue(value) {
  if (value === null || value === undefined) {
    return DEFAULT_VALUE;
  }

  const text = String(value).trim();
  return text || DEFAULT_VALUE;
}

function buildAppointmentReminderValues({ appointment, barbershopName, appPublicUrl }) {
  return {
    barbearia: normalizeValue(barbershopName),
    cliente: normalizeValue(appointment?.client?.name),
    data: formatDate(appointment?.startAt),
    duracao: formatDuration(appointment?.service?.durationMinutes),
    hora: formatTime(appointment?.startAt),
    link: normalizeValue(appPublicUrl),
    preco: formatPrice(appointment?.service?.price),
    profissional: normalizeValue(appointment?.professional?.name),
    servico: normalizeValue(appointment?.service?.name),
  };
}

function replacePlaceholders(content, values, escapeValues) {
  if (typeof content !== "string" || !content) {
    return "";
  }

  return content.replace(PLACEHOLDER_REGEX, (fullMatch, key) => {
    if (!(key in REMINDER_TEMPLATE_ALLOWED_PLACEHOLDER_MAP)) {
      return fullMatch;
    }

    const value = normalizeValue(values[key]);
    return escapeValues ? escapeHtml(value) : value;
  });
}

function buildSafeHtmlFromText(text) {
  const escaped = escapeHtml(text).replace(/\n/g, "<br />");

  return [
    '<div style="margin:0;padding:24px;background:#f5f2ea;font-family:Arial,sans-serif;color:#1f1f1f;">',
    '<div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e6dfd1;border-radius:18px;padding:28px;line-height:1.6;">',
    escaped,
    "</div>",
    "</div>",
  ].join("");
}

function buildReminderTemplateLog(details) {
  return {
    action: details.action ?? null,
    channel: details.channel ?? null,
    email: details.email ?? null,
    providerMessageId: details.providerMessageId ?? null,
    reason: details.reason ?? "unknown",
    success: details.success ?? null,
    templateId: details.templateId ?? null,
    type: details.type ?? null,
    userId: details.userId ?? null,
  };
}

function logReminderTemplateFallback(logger, details) {
  logger.warn("[reminder-template]", JSON.stringify(buildReminderTemplateLog(details)));
}

function logReminderTemplateInfo(logger, details) {
  logger.info("[reminder-template]", JSON.stringify(buildReminderTemplateLog(details)));
}

function maskEmail(email) {
  if (typeof email !== "string") {
    return DEFAULT_VALUE;
  }

  const trimmed = email.trim();
  const [localPart = "", domain = ""] = trimmed.split("@");

  if (!localPart || !domain) {
    return DEFAULT_VALUE;
  }

  return `${localPart[0]}***@${domain}`;
}

function isValidSingleEmail(email) {
  return SINGLE_EMAIL_REGEX.test(String(email ?? "").trim());
}

function getPreviewContext(appPublicUrl) {
  return {
    appPublicUrl: appPublicUrl?.trim() || DEFAULT_VALUE,
    appointment: {
      ...EMAIL_TEST_SAMPLE_CONTEXT.appointment,
      client: { ...EMAIL_TEST_SAMPLE_CONTEXT.appointment.client },
      professional: { ...EMAIL_TEST_SAMPLE_CONTEXT.appointment.professional },
      service: { ...EMAIL_TEST_SAMPLE_CONTEXT.appointment.service },
    },
    barbershopName: EMAIL_TEST_SAMPLE_CONTEXT.barbershopName,
  };
}

function hasInlineTemplateInput(payload) {
  return ["subject", "bodyText", "bodyHtml"].some((field) =>
    Object.prototype.hasOwnProperty.call(payload, field),
  );
}

function getTemplatePlaceholders(template) {
  return extractPlaceholders(template.subject, template.bodyText, template.bodyHtml);
}

function buildFallbackTemplateResult(context) {
  const rendered = buildAppointmentReminderEmailTemplate(context);

  return {
    fallbackUsed: true,
    placeholdersUsed: [],
    rendered,
    templateId: null,
  };
}

function sanitizeProviderError(error) {
  if (error instanceof EmailProviderError) {
    return error.code || "EMAIL_PROVIDER_ERROR";
  }

  return "EMAIL_PROVIDER_ERROR";
}

function compileReminderTemplate(template) {
  const normalized = validateReminderTemplatePayload(template);

  return (context) => {
    const values =
      normalized.type === REMINDER_TEMPLATE_TYPES.APPOINTMENT_REMINDER
        ? buildAppointmentReminderValues(context)
        : {};
    const subject = normalized.subject
      ? replacePlaceholders(normalized.subject, values, false)
      : null;
    const text = replacePlaceholders(normalized.bodyText, values, false);
    const htmlSource = normalized.bodyHtml
      ? replacePlaceholders(normalized.bodyHtml, values, true)
      : buildSafeHtmlFromText(text);

    return {
      subject,
      text,
      html: htmlSource,
    };
  };
}

export function renderReminderTemplate(template, context) {
  const renderer = compileReminderTemplate(template);
  return renderer(context);
}

export async function getAppointmentReminderEmailRenderer(options = {}) {
  const hasActiveTemplateOverride = Object.prototype.hasOwnProperty.call(
    options,
    "activeTemplate",
  );
  const activeTemplate = hasActiveTemplateOverride
    ? options.activeTemplate
    : await findActiveReminderTemplate(
        REMINDER_TEMPLATE_TYPES.APPOINTMENT_REMINDER,
        REMINDER_TEMPLATE_CHANNELS.EMAIL,
      );
  const logger = options.logger ?? console;

  if (!activeTemplate) {
    return (context) => buildAppointmentReminderEmailTemplate(context);
  }

  try {
    const renderer = compileReminderTemplate(activeTemplate);

    return (context) => {
      const rendered = renderer(context);

      return {
        subject: rendered.subject || buildAppointmentReminderEmailTemplate(context).subject,
        html: rendered.html,
        text: rendered.text,
      };
    };
  } catch {
    logReminderTemplateFallback(logger, {
      channel: REMINDER_CHANNELS.EMAIL,
      reason: "invalid_active_template",
      templateId: activeTemplate.id,
      type: REMINDER_TEMPLATE_TYPES.APPOINTMENT_REMINDER,
    });

    return (context) => buildAppointmentReminderEmailTemplate(context);
  }
}

async function resolveEmailTemplateRender({
  repository,
  logger,
  payload,
  runtimeConfig,
}) {
  ensureEmailReminderTypeAndChannel(payload.type, payload.channel);

  const context = getPreviewContext(runtimeConfig.appPublicUrl);

  if (payload.templateId) {
    const template = await repository.findReminderTemplateById(payload.templateId);

    if (!template) {
      throw new NotFoundError(NOT_FOUND_MESSAGE);
    }

    if (template.type !== payload.type || template.channel !== payload.channel) {
      throw new BadRequestError("Template informado não corresponde ao tipo/canal solicitado.");
    }

    try {
      return {
        fallbackUsed: false,
        placeholdersUsed: getTemplatePlaceholders(template),
        rendered: renderReminderTemplate(template, context),
        templateId: template.id,
      };
    } catch {
      logReminderTemplateFallback(logger, {
        action: "email_template_preview",
        channel: payload.channel,
        reason: "invalid_template_by_id",
        templateId: template.id,
        type: payload.type,
      });

      return buildFallbackTemplateResult(context);
    }
  }

  if (hasInlineTemplateInput(payload)) {
    const templateInput = validateReminderTemplatePayload({
      type: payload.type,
      channel: payload.channel,
      name: "Preview de template",
      subject: payload.subject ?? null,
      bodyText: payload.bodyText ?? "",
      bodyHtml: payload.bodyHtml ?? null,
      isActive: false,
    });

    return {
      fallbackUsed: false,
      placeholdersUsed: getTemplatePlaceholders(templateInput),
      rendered: renderReminderTemplate(templateInput, context),
      templateId: null,
    };
  }

  const activeTemplate = await repository.findActiveReminderTemplate(
    payload.type,
    payload.channel,
  );

  if (!activeTemplate) {
    return buildFallbackTemplateResult(context);
  }

  try {
    return {
      fallbackUsed: false,
      placeholdersUsed: getTemplatePlaceholders(activeTemplate),
      rendered: renderReminderTemplate(activeTemplate, context),
      templateId: activeTemplate.id,
    };
  } catch {
    logReminderTemplateFallback(logger, {
      action: "email_template_preview",
      channel: payload.channel,
      reason: "invalid_active_template",
      templateId: activeTemplate.id,
      type: payload.type,
    });

    return buildFallbackTemplateResult(context);
  }
}

export function createReminderTemplateService(deps = {}) {
  const repository = {
    activateReminderTemplate:
      deps.activateReminderTemplate ?? repoActivateReminderTemplate,
    countReminderTemplates:
      deps.countReminderTemplates ?? countReminderTemplates,
    createReminderTemplate: deps.createReminderTemplate ?? repoCreateReminderTemplate,
    createReminderTemplateWithActivation:
      deps.createReminderTemplateWithActivation ?? createReminderTemplateWithActivation,
    deactivateReminderTemplate:
      deps.deactivateReminderTemplate ?? repoDeactivateReminderTemplate,
    findActiveReminderTemplate:
      deps.findActiveReminderTemplate ?? findActiveReminderTemplate,
    findReminderTemplateById:
      deps.findReminderTemplateById ?? findReminderTemplateById,
    listReminderTemplates:
      deps.listReminderTemplates ?? repoListReminderTemplates,
    updateReminderTemplate: deps.updateReminderTemplate ?? repoUpdateReminderTemplate,
    updateReminderTemplateWithActivation:
      deps.updateReminderTemplateWithActivation ?? updateReminderTemplateWithActivation,
  };
  const emailProvider = deps.emailProvider ?? createEmailProvider();
  const logger = deps.logger ?? console;
  const runtimeConfig = {
    appPublicUrl: deps.runtimeConfig?.appPublicUrl ?? env.APP_PUBLIC_URL,
    emailReplyTo: deps.runtimeConfig?.emailReplyTo ?? env.EMAIL_REPLY_TO,
  };

  async function listTemplates(query, actor) {
    ensureAdminActor(actor);

    const [items, total] = await Promise.all([
      repository.listReminderTemplates(query),
      repository.countReminderTemplates(query),
    ]);

    return {
      items,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
      },
    };
  }

  async function getTemplateById(id, actor) {
    ensureAdminActor(actor);

    const template = await repository.findReminderTemplateById(id);

    if (!template) {
      throw new NotFoundError(NOT_FOUND_MESSAGE);
    }

    return template;
  }

  async function createTemplate(payload, actor) {
    ensureAdminActor(actor);

    const normalized = validateReminderTemplatePayload(payload);

    if (normalized.isActive) {
      return repository.createReminderTemplateWithActivation(normalized);
    }

    return repository.createReminderTemplate(normalized);
  }

  async function updateTemplate(id, payload, actor) {
    ensureAdminActor(actor);

    const current = await repository.findReminderTemplateById(id);

    if (!current) {
      throw new NotFoundError(NOT_FOUND_MESSAGE);
    }

    const normalized = validateReminderTemplatePayload({
      ...current,
      ...payload,
      id: undefined,
    });

    if (normalized.isActive) {
      return repository.updateReminderTemplateWithActivation(id, current, normalized);
    }

    return repository.updateReminderTemplate(id, normalized);
  }

  async function activateTemplate(id, actor) {
    ensureAdminActor(actor);

    const current = await repository.findReminderTemplateById(id);

    if (!current) {
      throw new NotFoundError(NOT_FOUND_MESSAGE);
    }

    return repository.activateReminderTemplate(id, current.type, current.channel);
  }

  async function deactivateTemplate(id, actor) {
    ensureAdminActor(actor);

    const current = await repository.findReminderTemplateById(id);

    if (!current) {
      throw new NotFoundError(NOT_FOUND_MESSAGE);
    }

    return repository.deactivateReminderTemplate(id);
  }

  async function getActiveTemplate(type, channel) {
    return repository.findActiveReminderTemplate(type, channel);
  }

  async function previewEmailTemplate(payload, actor) {
    ensureAdminActor(actor);

    const result = await resolveEmailTemplateRender({
      repository,
      logger,
      payload,
      runtimeConfig,
    });

    logReminderTemplateInfo(logger, {
      action: "email_template_preview",
      channel: payload.channel,
      success: true,
      templateId: result.templateId,
      type: payload.type,
      userId: actor.id ?? null,
    });

    return {
      subject: result.rendered.subject || DEFAULT_VALUE,
      text: result.rendered.text || DEFAULT_VALUE,
      html: result.rendered.html || DEFAULT_VALUE,
      placeholdersUsed: result.placeholdersUsed,
      fallbackUsed: result.fallbackUsed,
    };
  }

  async function sendTestEmail(payload, actor) {
    ensureAdminActor(actor);
    ensureEmailReminderTypeAndChannel(payload.type, payload.channel);

    if (!isValidSingleEmail(payload.to)) {
      throw new BadRequestError("Informe um e-mail válido.");
    }

    const maskedEmail = maskEmail(payload.to);
    const result = await resolveEmailTemplateRender({
      repository,
      logger,
      payload,
      runtimeConfig,
    });

    try {
      const sendResult = await emailProvider.sendEmail({
        to: payload.to,
        subject: result.rendered.subject,
        html: result.rendered.html,
        text: result.rendered.text,
        replyTo: runtimeConfig.emailReplyTo || undefined,
        metadata: {
          channel: payload.channel,
          templateId: result.templateId,
          testSend: true,
          type: payload.type,
          userId: actor.id ?? null,
        },
      });

      logReminderTemplateInfo(logger, {
        action: "email_template_test_send",
        channel: payload.channel,
        email: maskedEmail,
        providerMessageId: sendResult?.providerMessageId ?? null,
        success: true,
        templateId: result.templateId,
        type: payload.type,
        userId: actor.id ?? null,
      });

      return {
        fallbackUsed: result.fallbackUsed,
        providerMessageId: sendResult?.providerMessageId ?? null,
      };
    } catch (error) {
      logReminderTemplateFallback(logger, {
        action: "email_template_test_send",
        channel: payload.channel,
        email: maskedEmail,
        reason: sanitizeProviderError(error),
        success: false,
        templateId: result.templateId,
        type: payload.type,
        userId: actor.id ?? null,
      });

      throw new BadRequestError("Não foi possível enviar o teste agora.");
    }
  }

  return {
    activateTemplate,
    createTemplate,
    deactivateTemplate,
    getActiveTemplate,
    getTemplateById,
    listTemplates,
    previewEmailTemplate,
    sendTestEmail,
    updateTemplate,
  };
}

const reminderTemplateService = createReminderTemplateService();

export const activateReminderTemplate = reminderTemplateService.activateTemplate;
export const createReminderTemplate = reminderTemplateService.createTemplate;
export const deactivateReminderTemplate = reminderTemplateService.deactivateTemplate;
export const getActiveReminderTemplate = reminderTemplateService.getActiveTemplate;
export const getReminderTemplateById = reminderTemplateService.getTemplateById;
export const listReminderTemplates = reminderTemplateService.listTemplates;
export const previewEmailTemplate = reminderTemplateService.previewEmailTemplate;
export const sendTestEmail = reminderTemplateService.sendTestEmail;
export const updateReminderTemplate = reminderTemplateService.updateTemplate;
