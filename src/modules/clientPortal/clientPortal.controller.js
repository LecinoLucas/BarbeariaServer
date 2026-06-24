import { successResponse } from "../../utils/response.js";
import {
  cancelOwnAppointment,
  createOwnClientAppointment,
  getClientPortalConfig,
  getClientPortalAvailability,
  getClientDashboard,
  getClientProfile,
  listClientAppointments,
  listClientPortalProfessionals,
  listClientPortalServices,
  listClientAttendances,
  rescheduleOwnAppointment,
  updateOwnClientProfile,
} from "./clientPortal.service.js";
import {
  validateCreateClientPortalAppointment,
  validateClientPortalAvailabilityQuery,
  validateListClientAppointmentsQuery,
  validateListClientAttendancesQuery,
  validateRescheduleClientAppointment,
  validateUpdateClientProfile,
} from "./clientPortal.validator.js";

export async function getClientDashboardHandler(req, res, next) {
  try {
    const data = await getClientDashboard(req.user.id);
    return successResponse(res, data, "Dashboard do cliente carregado com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function getClientPortalConfigHandler(req, res, next) {
  try {
    const data = await getClientPortalConfig();
    return successResponse(res, data, "Configurações do portal carregadas com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function listClientPortalServicesHandler(req, res, next) {
  try {
    const data = await listClientPortalServices(req.user.id);
    return successResponse(res, data, "Serviços do portal carregados com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function listClientPortalProfessionalsHandler(req, res, next) {
  try {
    const data = await listClientPortalProfessionals(req.user.id);
    return successResponse(res, data, "Profissionais do portal carregados com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function getClientPortalAvailabilityHandler(req, res, next) {
  try {
    const query = validateClientPortalAvailabilityQuery(req.query);
    const data = await getClientPortalAvailability(query, req.user.id);
    return successResponse(res, data, "Horários disponíveis carregados com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function createClientAppointmentHandler(req, res, next) {
  try {
    const payload = validateCreateClientPortalAppointment(req.body);
    const data = await createOwnClientAppointment(payload, req.user.id);
    return successResponse(res, data, "Agendamento criado com sucesso.", 201);
  } catch (error) {
    return next(error);
  }
}

export async function listClientAppointmentsHandler(req, res, next) {
  try {
    const query = validateListClientAppointmentsQuery(req.query);
    const data = await listClientAppointments(query, req.user.id);
    return successResponse(res, data, "Agendamentos listados com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function listClientAttendancesHandler(req, res, next) {
  try {
    const query = validateListClientAttendancesQuery(req.query);
    const data = await listClientAttendances(query, req.user.id);
    return successResponse(res, data, "Atendimentos listados com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function getClientProfileHandler(req, res, next) {
  try {
    const data = await getClientProfile(req.user.id);
    return successResponse(res, data, "Perfil do cliente encontrado com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function updateClientProfileHandler(req, res, next) {
  try {
    const payload = validateUpdateClientProfile(req.body);
    const data = await updateOwnClientProfile(payload, req.user.id);
    return successResponse(res, data, "Perfil do cliente atualizado com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function cancelClientAppointmentHandler(req, res, next) {
  try {
    const data = await cancelOwnAppointment(req.params.id, req.user.id);
    return successResponse(res, data, "Agendamento cancelado com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function rescheduleClientAppointmentHandler(req, res, next) {
  try {
    const payload = validateRescheduleClientAppointment(req.body);
    const data = await rescheduleOwnAppointment(req.params.id, payload, req.user.id);
    return successResponse(res, data, "Agendamento reagendado com sucesso.");
  } catch (error) {
    return next(error);
  }
}
