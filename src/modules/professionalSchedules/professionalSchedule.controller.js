import { successResponse } from "../../utils/response.js";
import {
  createProfessionalSchedule,
  deleteProfessionalSchedule,
  getProfessionalScheduleById,
  listProfessionalSchedules,
  updateProfessionalSchedule,
  updateProfessionalScheduleStatus,
} from "./professionalSchedule.service.js";
import {
  validateCreateProfessionalSchedule,
  validateListProfessionalSchedulesQuery,
  validateUpdateProfessionalSchedule,
  validateUpdateProfessionalScheduleStatus,
} from "./professionalSchedule.validator.js";

export async function createProfessionalScheduleHandler(req, res, next) {
  try {
    const payload = validateCreateProfessionalSchedule(req.body);
    const schedule = await createProfessionalSchedule(payload);
    return successResponse(res, schedule, "Horário do profissional criado com sucesso.", 201);
  } catch (error) {
    return next(error);
  }
}

export async function listProfessionalSchedulesHandler(req, res, next) {
  try {
    const query = validateListProfessionalSchedulesQuery(req.query);
    const schedules = await listProfessionalSchedules(query, req.user);
    return successResponse(res, schedules, "Horários listados com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function getProfessionalScheduleByIdHandler(req, res, next) {
  try {
    const schedule = await getProfessionalScheduleById(req.params.id, req.user);
    return successResponse(res, schedule, "Horário encontrado com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function updateProfessionalScheduleHandler(req, res, next) {
  try {
    const payload = validateUpdateProfessionalSchedule(req.body);
    const schedule = await updateProfessionalSchedule(req.params.id, payload);
    return successResponse(res, schedule, "Horário atualizado com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function updateProfessionalScheduleStatusHandler(req, res, next) {
  try {
    const payload = validateUpdateProfessionalScheduleStatus(req.body);
    const schedule = await updateProfessionalScheduleStatus(req.params.id, payload);
    return successResponse(res, schedule, "Status do horário atualizado com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function deleteProfessionalScheduleHandler(req, res, next) {
  try {
    await deleteProfessionalSchedule(req.params.id);
    return successResponse(res, null, "Horário removido com sucesso.");
  } catch (error) {
    return next(error);
  }
}
