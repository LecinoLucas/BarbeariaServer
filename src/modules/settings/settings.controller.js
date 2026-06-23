import { successResponse } from "../../utils/response.js";
import { getSettings, updateSettings } from "./settings.service.js";
import { validateSettings } from "./settings.validator.js";

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
