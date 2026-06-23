import { successResponse } from "../../utils/response.js";
import { getDashboard } from "./dashboard.service.js";

export async function getDashboardHandler(req, res, next) {
  try {
    const data = await getDashboard();

    return successResponse(res, data, "Dashboard carregado com sucesso.");
  } catch (error) {
    return next(error);
  }
}
