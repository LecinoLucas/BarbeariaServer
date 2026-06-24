import { ServiceUnavailableError } from "../../errors/ServiceUnavailableError.js";
import { getClientPortalSettings } from "../settings/settings.service.js";

export async function ensureClientPortalEnabled(req, res, next) {
  try {
    const config = await getClientPortalSettings();

    if (!config.enabled) {
      throw new ServiceUnavailableError("Portal do Cliente temporariamente indisponível.");
    }

    return next();
  } catch (error) {
    return next(error);
  }
}

export async function ensureClientPortalLoginEnabled(req, res, next) {
  try {
    const config = await getClientPortalSettings();

    if (!config.enabled) {
      throw new ServiceUnavailableError("Portal do Cliente temporariamente indisponível.");
    }

    return next();
  } catch (error) {
    return next(error);
  }
}
