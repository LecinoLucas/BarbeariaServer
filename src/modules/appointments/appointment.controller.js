import { successResponse } from "../../utils/response.js";
import {
  createAppointment,
  deleteAppointment,
  getAppointmentsByDay,
  getAppointmentsByWeek,
  getAppointmentsMonthSummary,
  getAppointmentById,
  getAvailability,
  getUpcomingAppointmentAlerts,
  listAppointments,
  rescheduleAppointment,
  updateAppointment,
  updateAppointmentStatus,
} from "./appointment.service.js";
import {
  validateAvailabilityQuery,
  validateCreateAppointment,
  validateDayAppointmentsQuery,
  validateListAppointmentsQuery,
  validateMonthSummaryAppointmentsQuery,
  validateUpcomingAlertsQuery,
  validateRescheduleAppointment,
  validateUpdateAppointment,
  validateUpdateAppointmentStatus,
  validateWeekAppointmentsQuery,
} from "./appointment.validator.js";


export async function createAppointmentHandler(req, res, next) {
  try {
    const data = validateCreateAppointment(req.body);
    const appointment = await createAppointment(data, req.user);
    return successResponse(res, appointment, "Agendamento criado com sucesso.", 201);
  } catch (error) {
    return next(error);
  }
}

export async function listAppointmentsHandler(req, res, next) {
  try {
    const query = validateListAppointmentsQuery(req.query);
    const result = await listAppointments(query, req.user);
    return successResponse(res, result, "Agendamentos listados com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function listAppointmentsByDayHandler(req, res, next) {
  try {
    const query = validateDayAppointmentsQuery(req.query);
    const result = await getAppointmentsByDay(query, req.user);
    return successResponse(res, result, "Agenda do dia listada com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function listAppointmentsByWeekHandler(req, res, next) {
  try {
    const query = validateWeekAppointmentsQuery(req.query);
    const result = await getAppointmentsByWeek(query, req.user);
    return successResponse(res, result, "Agenda da semana listada com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function listAppointmentsMonthSummaryHandler(req, res, next) {
  try {
    const query = validateMonthSummaryAppointmentsQuery(req.query);
    const result = await getAppointmentsMonthSummary(query, req.user);
    return successResponse(res, result, "Resumo mensal da agenda listado com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function getAvailabilityHandler(req, res, next) {
  try {
    const query = validateAvailabilityQuery(req.query);
    const result = await getAvailability(query);
    return successResponse(res, result, "Disponibilidade listada com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function getUpcomingAlertsHandler(req, res, next) {
  try {
    const query = validateUpcomingAlertsQuery(req.query);
    const result = await getUpcomingAppointmentAlerts(query, req.user);
    return successResponse(res, result, "Próximos agendamentos carregados com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function getAppointmentByIdHandler(req, res, next) {
  try {
    const appointment = await getAppointmentById(req.params.id, req.user);
    return successResponse(res, appointment, "Agendamento encontrado com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function updateAppointmentHandler(req, res, next) {
  try {
    const data = validateUpdateAppointment(req.body);
    const appointment = await updateAppointment(req.params.id, data, req.user);
    return successResponse(res, appointment, "Agendamento atualizado com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function updateAppointmentStatusHandler(req, res, next) {
  try {
    const data = validateUpdateAppointmentStatus(req.body);
    const appointment = await updateAppointmentStatus(req.params.id, data, req.user);
    return successResponse(res, appointment, "Status do agendamento atualizado com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function rescheduleAppointmentHandler(req, res, next) {
  try {
    const data = validateRescheduleAppointment(req.body);
    const appointment = await rescheduleAppointment(req.params.id, data, req.user);
    return successResponse(res, appointment, "Agendamento reagendado com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function deleteAppointmentHandler(req, res, next) {
  try {
    await deleteAppointment(req.params.id);
    return successResponse(res, null, "Agendamento removido com sucesso.");
  } catch (error) {
    return next(error);
  }
}
