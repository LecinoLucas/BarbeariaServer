import { successResponse } from "../../utils/response.js";
import {
  createProfessional,
  deleteProfessional,
  getMyProfessionalProfile,
  getProfessionalById,
  listProfessionals,
  updateProfessional,
  updateProfessionalStatus,
} from "./professional.service.js";
import {
  validateCreateProfessional,
  validateListProfessionalsQuery,
  validateUpdateProfessional,
  validateUpdateProfessionalStatus,
} from "./professional.validator.js";

export async function createProfessionalHandler(req, res, next) {
  try {
    const payload = validateCreateProfessional(req.body);
    const professional = await createProfessional(payload);
    return successResponse(res, professional, "Profissional criado com sucesso.", 201);
  } catch (error) {
    return next(error);
  }
}

export async function listProfessionalsHandler(req, res, next) {
  try {
    const query = validateListProfessionalsQuery(req.query);
    const result = await listProfessionals(query, req.user);
    return successResponse(res, result, "Profissionais listados com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function getMyProfessionalProfileHandler(req, res, next) {
  try {
    const professional = await getMyProfessionalProfile(req.user.id);
    return successResponse(res, professional, "Perfil profissional encontrado com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function getProfessionalByIdHandler(req, res, next) {
  try {
    const professional = await getProfessionalById(req.params.id, req.user);
    return successResponse(res, professional, "Profissional encontrado com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function updateProfessionalHandler(req, res, next) {
  try {
    const payload = validateUpdateProfessional(req.body);
    const professional = await updateProfessional(req.params.id, payload, req.user);
    return successResponse(res, professional, "Profissional atualizado com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function updateProfessionalStatusHandler(req, res, next) {
  try {
    const payload = validateUpdateProfessionalStatus(req.body);
    const professional = await updateProfessionalStatus(req.params.id, payload);
    return successResponse(res, professional, "Status do profissional atualizado com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function deleteProfessionalHandler(req, res, next) {
  try {
    await deleteProfessional(req.params.id);
    return successResponse(res, null, "Profissional removido com sucesso.");
  } catch (error) {
    return next(error);
  }
}
