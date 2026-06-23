import { successResponse } from "../../utils/response.js";
import {
  activateReminderTemplate,
  createReminderTemplate,
  deactivateReminderTemplate,
  getReminderTemplateById,
  listReminderTemplates,
  previewEmailTemplate,
  sendTestEmail,
  updateReminderTemplate,
} from "./reminderTemplate.service.js";
import {
  validateCreateReminderTemplate,
  validateListReminderTemplatesQuery,
  validatePreviewReminderTemplateEmail,
  validateSendReminderTemplateTestEmail,
  validateUpdateReminderTemplate,
} from "./reminderTemplate.validator.js";

export async function listReminderTemplatesHandler(req, res, next) {
  try {
    const query = validateListReminderTemplatesQuery(req.query);
    const data = await listReminderTemplates(query, req.user);
    return successResponse(res, data, "Templates de lembrete listados com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function getReminderTemplateByIdHandler(req, res, next) {
  try {
    const data = await getReminderTemplateById(req.params.id, req.user);
    return successResponse(res, data, "Template de lembrete encontrado com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function createReminderTemplateHandler(req, res, next) {
  try {
    const payload = validateCreateReminderTemplate(req.body);
    const data = await createReminderTemplate(payload, req.user);
    return successResponse(res, data, "Template de lembrete criado com sucesso.", 201);
  } catch (error) {
    return next(error);
  }
}

export async function updateReminderTemplateHandler(req, res, next) {
  try {
    const payload = validateUpdateReminderTemplate(req.body);
    const data = await updateReminderTemplate(req.params.id, payload, req.user);
    return successResponse(res, data, "Template de lembrete atualizado com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function activateReminderTemplateHandler(req, res, next) {
  try {
    const data = await activateReminderTemplate(req.params.id, req.user);
    return successResponse(res, data, "Template de lembrete ativado com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function deactivateReminderTemplateHandler(req, res, next) {
  try {
    const data = await deactivateReminderTemplate(req.params.id, req.user);
    return successResponse(res, data, "Template de lembrete desativado com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function previewReminderTemplateEmailHandler(req, res, next) {
  try {
    const payload = validatePreviewReminderTemplateEmail(req.body);
    const data = await previewEmailTemplate(payload, req.user);
    return successResponse(res, data, "Preview de e-mail gerado com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function sendReminderTemplateTestEmailHandler(req, res, next) {
  try {
    const payload = validateSendReminderTemplateTestEmail(req.body);
    const data = await sendTestEmail(payload, req.user);
    return successResponse(res, data, "E-mail de teste enviado com sucesso.");
  } catch (error) {
    return next(error);
  }
}
