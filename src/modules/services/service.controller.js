import { successResponse } from "../../utils/response.js";
import {
  createService,
  deleteService,
  getServiceById,
  listServices,
  updateService,
  updateServiceStatus,
} from "./service.service.js";
import {
  validateCreateService,
  validateListServicesQuery,
  validateUpdateService,
  validateUpdateServiceStatus,
} from "./service.validator.js";


export async function createServiceHandler(req, res, next) {
  try {
    const data = validateCreateService(req.body);
    const service = await createService(data);
    return successResponse(res, service, "Serviço criado com sucesso.", 201);
  } catch (error) {
    return next(error);
  }
}

export async function listServicesHandler(req, res, next) {
  try {
    const query = validateListServicesQuery(req.query);
    const result = await listServices(query, req.user);
    return successResponse(res, result, "Serviços listados com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function getServiceByIdHandler(req, res, next) {
  try {
    const service = await getServiceById(req.params.id, req.user);
    return successResponse(res, service, "Serviço encontrado com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function updateServiceHandler(req, res, next) {
  try {
    const data = validateUpdateService(req.body);
    const service = await updateService(req.params.id, data);
    return successResponse(res, service, "Serviço atualizado com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function updateServiceStatusHandler(req, res, next) {
  try {
    const data = validateUpdateServiceStatus(req.body);
    const service = await updateServiceStatus(req.params.id, data);
    return successResponse(res, service, "Status do serviço atualizado com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function deleteServiceHandler(req, res, next) {
  try {
    await deleteService(req.params.id);
    return successResponse(res, null, "Serviço removido com sucesso.");
  } catch (error) {
    return next(error);
  }
}
