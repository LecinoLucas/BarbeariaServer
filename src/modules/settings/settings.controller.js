import { successResponse } from "../../utils/response.js";
import {
  getLoginAppearance,
  getPublicLoginAppearance,
  getPublicPortalSettings,
  getSettings,
  restoreDefaultLoginAppearance,
  saveLoginAppearanceBackground,
  updateLoginAppearance,
  updatePublicPortalSettings,
  updateSettings,
} from "./settings.service.js";
import {
  validateLoginAppearance,
  validateSettings,
} from "./settings.validator.js";
import { validatePublicPortalSettings } from "./publicPortal.validator.js";

export async function getPublicPortalSettingsHandler(req, res, next) {
  try {
    const settings = await getPublicPortalSettings();
    return successResponse(res, settings, "Configurações do portal carregadas com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function updatePublicPortalSettingsHandler(req, res, next) {
  try {
    const data = validatePublicPortalSettings(req.body);
    const settings = await updatePublicPortalSettings(data);
    return successResponse(res, settings, "Configurações do portal atualizadas com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function getSettingsHandler(req, res, next) {
  try {
    const settings = await getSettings();
    return successResponse(res, settings, "Configurações carregadas com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function updateSettingsHandler(req, res, next) {
  try {
    const data = validateSettings(req.body);
    const settings = await updateSettings(data);
    return successResponse(res, settings, "Configurações atualizadas com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function getLoginAppearanceHandler(req, res, next) {
  try {
    const settings = await getLoginAppearance();
    return successResponse(res, settings, "Aparência do login carregada com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function getPublicLoginAppearanceHandler(req, res, next) {
  try {
    const settings = await getPublicLoginAppearance();
    return successResponse(res, settings, "Aparência pública do login carregada com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function updateLoginAppearanceHandler(req, res, next) {
  try {
    const data = validateLoginAppearance(req.body);
    const settings = await updateLoginAppearance(data);
    return successResponse(res, settings, "Aparência do login atualizada com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function uploadLoginAppearanceBackgroundHandler(req, res, next) {
  try {
    const payload = await saveLoginAppearanceBackground({
      body: req.body,
      mimeType: req.headers["content-type"],
      originalName: req.headers["x-file-name"],
    });

    return successResponse(res, payload, "Imagem de fundo atualizada com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function restoreDefaultLoginAppearanceHandler(req, res, next) {
  try {
    const settings = await restoreDefaultLoginAppearance();
    return successResponse(res, settings, "Aparência do login restaurada com sucesso.");
  } catch (error) {
    return next(error);
  }
}
