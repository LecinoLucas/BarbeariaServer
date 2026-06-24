import { successResponse } from "../../utils/response.js";
import { getPublicPortal, getPublicProducts, getPublicServices } from "./public.service.js";

export async function getPublicPortalHandler(req, res, next) {
  try {
    const data = await getPublicPortal();
    return successResponse(res, data, "Portal carregado com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function getPublicServicesHandler(req, res, next) {
  try {
    const { page, limit } = req.query;
    const data = await getPublicServices({ page, limit });
    return successResponse(res, data, "Serviços carregados com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function getPublicProductsHandler(req, res, next) {
  try {
    const { page, limit } = req.query;
    const data = await getPublicProducts({ page, limit });
    return successResponse(res, data, "Produtos carregados com sucesso.");
  } catch (error) {
    return next(error);
  }
}
