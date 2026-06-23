import { Prisma } from "@prisma/client";
import { DateTime } from "luxon";

import prisma from "../../database/prisma.js";
import { APPOINTMENT_STATUS } from "../../constants/appointmentStatus.js";
import { ROLES } from "../../constants/roles.js";
import { SERVICE_STATUS } from "../../constants/serviceStatus.js";
import { USER_STATUS } from "../../constants/userStatus.js";
import { NOTIFICATION_TYPES } from "../../constants/notificationTypes.js";
import { emitToAdmins } from "../../socket/socket.emitter.js";
import { SOCKET_EVENTS } from "../../socket/socket.events.js";
import {
  cancelReminderForAppointment,
  createReminderForAppointment,
  recalculateReminderForAppointment,
} from "../appointmentReminders/appointmentReminder.service.js";
import { createNotificationsForAdmins } from "../notifications/notification.service.js";
import { BadRequestError } from "../../errors/BadRequestError.js";
import { ConflictError } from "../../errors/ConflictError.js";
import { ForbiddenError } from "../../errors/ForbiddenError.js";
import { NotFoundError } from "../../errors/NotFoundError.js";
import {
  count,
  create,
  findById,
  findAppointmentForReschedule,
  findClientById,
  findActiveClientServiceAppointment,
  findClientByUserId,
  findConflictingAppointment,
  findConflictingScheduleBlock,
  findActiveProfessionalScheduleByWeekday,
  findProfessionalAvailabilityContext,
  findProfessionalById,
  findProfessionalByUserId,
  findServiceById,
  getSystemSettings,
  list,
  listByDay,
  listByWeek,
  listMonthSummaryRows,
  listActiveRecurringBlocksForDay,
  listAppointmentsByDateAndProfessional,
  listScheduleBlocksByDateAndProfessional,
  softDelete,
  update,
  updateAppointmentSchedule,
  updateStatus,
} from "./appointment.repository.js";
import {
  AGENDA_TIME_ZONE,
  addMinutesUtc,
  assertBusinessDate,
  assertBusinessTime,
  combineBusinessDateAndTimeToUtc,
  getBusinessDateKeyFromUtc,
  getWeekdayInBusinessZone,
} from "../../utils/agendaTimezone.js";

const NOT_FOUND_MESSAGE = "Agendamento não encontrado.";
const ACCESS_DENIED_MESSAGE = "Acesso negado.";
const CONFLICT_MESSAGE = "Conflito de horário para o profissional selecionado.";
const SCHEDULE_BLOCK_CONFLICT_MESSAGE = "Horário bloqueado para o profissional selecionado.";
const RESCHEDULE_NOT_ALLOWED_MESSAGE = "Não é possível reagendar este agendamento.";
const AVAILABILITY_DEFAULTS = {
  default_open_time: "09:00",
  default_close_time: "18:00",
  appointment_interval_minutes: "5",
};
const SLOT_BLOCKING_STATUSES = [
  APPOINTMENT_STATUS.SCHEDULED,
  APPOINTMENT_STATUS.CONFIRMED,
  APPOINTMENT_STATUS.IN_ATTENDANCE,
];
const RESCHEDULABLE_STATUSES = [
  APPOINTMENT_STATUS.SCHEDULED,
  APPOINTMENT_STATUS.CONFIRMED,
];
const AGENDA_SETTINGS_KEYS = [
  "default_open_time",
  "default_close_time",
  "appointment_interval_minutes",
];
const RESCHEDULE_TRANSACTION_RETRIES = 2;

export function buildCalendarDays(startDate, endDate) {
  const startBusinessDate = assertBusinessDate(startDate);
  const endBusinessDate = assertBusinessDate(endDate);
  const days = [];
  let cursor = DateTime.fromISO(startBusinessDate, { zone: AGENDA_TIME_ZONE });
  const end = DateTime.fromISO(endBusinessDate, { zone: AGENDA_TIME_ZONE });

  while (cursor <= end) {
    days.push(cursor.toFormat("yyyy-MM-dd"));
    cursor = cursor.plus({ days: 1 });
  }

  return days;
}

function parseMonthDateRange(month) {
  const baseDate = DateTime.fromFormat(`${month}-01`, "yyyy-MM-dd", {
    zone: AGENDA_TIME_ZONE,
  });

  return {
    endDate: baseDate.endOf("month").toFormat("yyyy-MM-dd"),
    startDate: baseDate.startOf("month").toFormat("yyyy-MM-dd"),
  };
}

export function groupAppointmentsByBusinessDay(appointments, startDate, endDate) {
  const grouped = new Map();

  buildCalendarDays(startDate, endDate).forEach((day) => {
    grouped.set(day, { date: day, total: 0, appointments: [] });
  });

  appointments.forEach((appointment) => {
    const day = getBusinessDateKeyFromUtc(appointment.startAt);
    const group = grouped.get(day);

    if (!group) return;

    group.total += 1;
    group.appointments.push(appointment);
  });

  return Array.from(grouped.values());
}

export function summarizeAppointmentsByBusinessDay(rows) {
  const summary = new Map();

  rows.forEach((row) => {
    const day = getBusinessDateKeyFromUtc(row.startAt);
    const current = summary.get(day) ?? { date: day, total: 0, byStatus: {} };

    current.total += 1;
    current.byStatus[row.status] = (current.byStatus[row.status] || 0) + 1;

    summary.set(day, current);
  });

  return Array.from(summary.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function calcEndAt(startAt, durationMinutes) {
  return new Date(startAt.getTime() + durationMinutes * 60 * 1000);
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function isRetryableTransactionError(error) {
  return error?.code === "P2034";
}

async function runAppointmentWriteTransaction(handler) {
  for (let attempt = 0; attempt < RESCHEDULE_TRANSACTION_RETRIES; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => handler(tx),
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      if (isRetryableTransactionError(error) && attempt < RESCHEDULE_TRANSACTION_RETRIES - 1) {
        continue;
      }

      throw error;
    }
  }

  throw new ConflictError("Não foi possível concluir o reagendamento.");
}

function normalizeBusinessDate(date) {
  try {
    return assertBusinessDate(date);
  } catch {
    throw new BadRequestError("Data inválida.");
  }
}

function normalizeBusinessTime(time) {
  try {
    return assertBusinessTime(time);
  } catch {
    throw new BadRequestError("Horário inválido.");
  }
}

function toAvailabilitySettings(rows) {
  const values = {};

  for (const row of rows) {
    values[row.key] = row.value;
  }

  return {
    defaultOpenTime: values.default_open_time ?? AVAILABILITY_DEFAULTS.default_open_time,
    defaultCloseTime: values.default_close_time ?? AVAILABILITY_DEFAULTS.default_close_time,
    appointmentIntervalMinutes: Math.max(
      1,
      Number.parseInt(
        values.appointment_interval_minutes ??
          AVAILABILITY_DEFAULTS.appointment_interval_minutes,
        10,
      ) || 5,
    ),
  };
}

// Fallback chain: professional's own interval → global setting → hardcoded default (5 min)
export function resolveAppointmentIntervalMinutes(professional, settings) {
  const own = professional?.appointmentIntervalMinutes;

  if (Number.isInteger(own) && own > 0) {
    return own;
  }

  return settings.appointmentIntervalMinutes;
}

export function generateSlots(
  date,
  durationMinutes,
  intervalMinutes,
  startTime,
  endTime,
  existingAppointments,
  scheduleBlocks,
) {
  const slots = [];
  const dayStartUtc = combineBusinessDateAndTimeToUtc(date, startTime);
  const dayEndUtc = combineBusinessDateAndTimeToUtc(date, endTime);

  let current = dayStartUtc;

  while (current < dayEndUtc) {
    const slotEnd = addMinutesUtc(current, durationMinutes);

    if (slotEnd > dayEndUtc) break;

    const hasConflict = existingAppointments.some(
      (apt) => apt.startAt < slotEnd && apt.endAt > current,
    );

    const hasBlockConflict = scheduleBlocks.some(
      (block) => block.startAt < slotEnd && block.endAt > current,
    );

    if (!hasConflict && !hasBlockConflict) {
      slots.push({ startAt: current.toISOString(), endAt: slotEnd.toISOString() });
    }

    current = addMinutesUtc(current, intervalMinutes);
  }

  return slots;
}

function toAppointmentEventPayload(appointment) {
  return {
    id: appointment.id,
    client: appointment.client
      ? {
          id: appointment.client.id,
          name: appointment.client.name,
        }
      : null,
    professional: appointment.professional
      ? {
          id: appointment.professional.id,
          name: appointment.professional.name,
        }
      : null,
    service: appointment.service
      ? {
          id: appointment.service.id,
          name: appointment.service.name,
        }
      : null,
    startAt: appointment.startAt,
    endAt: appointment.endAt,
    status: appointment.status,
  };
}

async function validateClientActive(clientId) {
  const client = await findClientById(clientId);

  if (!client || client.status !== USER_STATUS.ACTIVE) {
    throw new BadRequestError("Cliente não encontrado ou inativo.");
  }

  return client;
}

async function validateProfessionalActive(professionalId) {
  const professional = await findProfessionalById(professionalId);

  if (!professional || professional.status !== USER_STATUS.ACTIVE) {
    throw new BadRequestError("Profissional não encontrado ou inativo.");
  }

  return professional;
}

async function validateServiceActive(serviceId) {
  const service = await findServiceById(serviceId);

  if (!service || service.status !== SERVICE_STATUS.ACTIVE) {
    throw new BadRequestError("Serviço não encontrado ou inativo.");
  }

  return service;
}

async function ensureNoScheduleBlockConflict(
  professionalId,
  startAt,
  endAt,
  ignoringId = null,
) {
  const block = await findConflictingScheduleBlock(
    professionalId,
    startAt,
    endAt,
    ignoringId,
  );

  if (block) {
    throw new ConflictError(SCHEDULE_BLOCK_CONFLICT_MESSAGE);
  }
}

function ensureReschedulableStatus(appointment) {
  if (!RESCHEDULABLE_STATUSES.includes(appointment.status)) {
    throw new BadRequestError(RESCHEDULE_NOT_ALLOWED_MESSAGE);
  }
}

async function enforceClientOwnership(clientId, actor) {
  if (actor.role !== ROLES.CLIENT) return;

  const own = await findClientByUserId(actor.id);

  if (!own || own.id !== clientId) {
    throw new ForbiddenError(ACCESS_DENIED_MESSAGE);
  }
}

async function enforceProfessionalOwnership(professionalId, actor) {
  if (actor.role !== ROLES.PROFESSIONAL) return;

  const own = await findProfessionalByUserId(actor.id);

  if (!own || own.id !== professionalId) {
    throw new ForbiddenError(ACCESS_DENIED_MESSAGE);
  }
}

async function ensureEditAccess(actor, appointment, prismaOrTx = prisma) {
  if (actor.role === ROLES.ADMIN) return;

  if (actor.role === ROLES.PROFESSIONAL) {
    const own = await findProfessionalByUserId(actor.id, prismaOrTx);

    if (!own || own.id !== appointment.professionalId) {
      throw new ForbiddenError(ACCESS_DENIED_MESSAGE);
    }

    return;
  }

  throw new ForbiddenError(ACCESS_DENIED_MESSAGE);
}

async function ensureViewAccess(actor, appointment) {
  if (actor.role === ROLES.ADMIN) return;

  if (actor.role === ROLES.PROFESSIONAL) {
    const own = await findProfessionalByUserId(actor.id);

    if (!own || own.id !== appointment.professionalId) {
      throw new ForbiddenError(ACCESS_DENIED_MESSAGE);
    }

    return;
  }

  if (actor.role === ROLES.CLIENT) {
    const own = await findClientByUserId(actor.id);

    if (!own || own.id !== appointment.clientId) {
      throw new ForbiddenError(ACCESS_DENIED_MESSAGE);
    }

    return;
  }

  throw new ForbiddenError(ACCESS_DENIED_MESSAGE);
}

function ensureEditableStatus(appointment, actor) {
  if (appointment.status === APPOINTMENT_STATUS.FINISHED) {
    throw new BadRequestError("Não é possível alterar um agendamento finalizado.");
  }

  if (
    appointment.status === APPOINTMENT_STATUS.CANCELED &&
    actor.role !== ROLES.ADMIN
  ) {
    throw new BadRequestError("Não é possível alterar um agendamento cancelado.");
  }
}

async function applyRoleFilters(filters, actor) {
  if (actor.role === ROLES.PROFESSIONAL) {
    const own = await findProfessionalByUserId(actor.id);
    return { ...filters, professionalId: own?.id ?? "none" };
  }

  if (actor.role === ROLES.CLIENT) {
    const own = await findClientByUserId(actor.id);
    return { ...filters, clientId: own?.id ?? "none" };
  }

  return filters;
}

export async function createAppointment(payload, actor) {
  await validateClientActive(payload.clientId);
  await enforceClientOwnership(payload.clientId, actor);

  await validateProfessionalActive(payload.professionalId);
  await enforceProfessionalOwnership(payload.professionalId, actor);

  const service = await validateServiceActive(payload.serviceId);

  if (!payload.confirmDuplicate) {
    const existingAppointment = await findActiveClientServiceAppointment(
      payload.clientId,
      payload.serviceId,
    );

    if (existingAppointment) {
      throw new ConflictError(
        "Este cliente já possui um agendamento ativo para este serviço.",
        "APPOINTMENT_DUPLICATE_CLIENT_SERVICE",
        {
          existingAppointment,
        },
      );
    }
  }

  const startAt = payload.startAt;
  const endAt = calcEndAt(startAt, service.durationMinutes);

  await ensureNoScheduleBlockConflict(payload.professionalId, startAt, endAt);

  const conflict = await findConflictingAppointment(payload.professionalId, startAt, endAt);

  if (conflict) throw new ConflictError(CONFLICT_MESSAGE);

  const appointment = await create({
    clientId: payload.clientId,
    professionalId: payload.professionalId,
    serviceId: payload.serviceId,
    startAt,
    endAt,
    status: payload.status,
    notes: payload.notes,
  });

  await createReminderForAppointment(appointment);

  await createNotificationsForAdmins({
    title: "Novo agendamento",
    message: "Um novo agendamento foi criado.",
    type: NOTIFICATION_TYPES.APPOINTMENT_CREATED,
    metadata: {
      appointmentId: appointment.id,
    },
  });

  emitToAdmins(SOCKET_EVENTS.APPOINTMENT_CREATED, toAppointmentEventPayload(appointment));

  return appointment;
}

export async function listAppointments(query, actor) {
  const filters = await applyRoleFilters(query, actor);
  const [items, total] = await Promise.all([list(filters), count(filters)]);

  return {
    items,
    meta: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / filters.limit),
    },
  };
}

export async function getAppointmentsByDay(query, actor) {
  const filters = await applyRoleFilters(query, actor);
  return listByDay(filters);
}

export async function getAppointmentsByWeek(query, actor) {
  const filters = await applyRoleFilters(query, actor);
  const appointments = await listByWeek(filters);
  return groupAppointmentsByBusinessDay(appointments, filters.startDate, filters.endDate);
}

export async function getAppointmentsMonthSummary(query, actor) {
  const filters = await applyRoleFilters(query, actor);
  const { endDate, startDate } = parseMonthDateRange(filters.month);
  const rows = await listMonthSummaryRows({
    clientId: filters.clientId,
    endDate,
    professionalId: filters.professionalId,
    search: filters.search,
    startDate,
    status: filters.status,
  });
  return summarizeAppointmentsByBusinessDay(rows);
}

export async function getAppointmentById(id, actor) {
  const appointment = await findById(id);

  if (!appointment) throw new NotFoundError(NOT_FOUND_MESSAGE);

  await ensureViewAccess(actor, appointment);

  return appointment;
}

export async function assertAppointmentSlotAvailability({
  appointmentIdToIgnore = null,
  professionalId,
  date,
  time,
  durationMinutes,
  prismaOrTx = prisma,
}) {
  const businessDate = normalizeBusinessDate(date);
  const businessTime = normalizeBusinessTime(time);

  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
    throw new BadRequestError("Este horário não está disponível para a duração deste serviço.");
  }

  const weekday = getWeekdayInBusinessZone(businessDate);
  const startUtc = combineBusinessDateAndTimeToUtc(businessDate, businessTime);
  const endUtc = addMinutesUtc(startUtc, durationMinutes);

  const [professional, settingRows, scheduleBlockConflict, appointmentConflict] = await Promise.all([
    findProfessionalAvailabilityContext(professionalId, weekday, prismaOrTx),
    getSystemSettings(AGENDA_SETTINGS_KEYS, prismaOrTx),
    findConflictingScheduleBlock(
      professionalId,
      startUtc,
      endUtc,
      null,
      prismaOrTx,
    ),
    findConflictingAppointment(
      professionalId,
      startUtc,
      endUtc,
      appointmentIdToIgnore,
      prismaOrTx,
    ),
  ]);

  if (!professional) {
    throw new BadRequestError("Profissional não encontrado.");
  }

  if (professional.status !== USER_STATUS.ACTIVE) {
    throw new BadRequestError("Profissional inativo.");
  }

  const settings = toAvailabilitySettings(settingRows);
  const schedule = professional.schedules[0] ?? null;
  const startTime = schedule?.openTime ?? settings.defaultOpenTime;
  const endTime = schedule?.closeTime ?? settings.defaultCloseTime;

  if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
    throw new BadRequestError("Este horário está fora do expediente do profissional.");
  }

  const workStartUtc = combineBusinessDateAndTimeToUtc(businessDate, startTime);
  const workEndUtc = combineBusinessDateAndTimeToUtc(businessDate, endTime);

  if (startUtc < workStartUtc || startUtc >= workEndUtc) {
    throw new BadRequestError("Este horário está fora do expediente do profissional.");
  }

  if (endUtc > workEndUtc) {
    throw new BadRequestError("Este horário não está disponível para a duração deste serviço.");
  }

  const recurringBlockConflict = professional.recurringBlocks.some((block) => {
    const blockStartUtc = combineBusinessDateAndTimeToUtc(businessDate, block.startTime);
    const blockEndUtc = combineBusinessDateAndTimeToUtc(businessDate, block.endTime);
    return blockStartUtc < endUtc && blockEndUtc > startUtc;
  });

  if (scheduleBlockConflict || recurringBlockConflict) {
    throw new ConflictError("Este horário está bloqueado.");
  }

  if (appointmentConflict && SLOT_BLOCKING_STATUSES.includes(appointmentConflict.status)) {
    throw new ConflictError("Este horário não está disponível para a duração deste serviço.");
  }

  return {
    professional,
    weekday,
    startUtc,
    endUtc,
  };
}

export async function updateAppointment(id, payload, actor) {
  const current = await findById(id);

  if (!current) throw new NotFoundError(NOT_FOUND_MESSAGE);

  await ensureEditAccess(actor, current);
  ensureEditableStatus(current, actor);

  await validateClientActive(payload.clientId);
  await validateProfessionalActive(payload.professionalId);
  const service = await validateServiceActive(payload.serviceId);

  const startAt = payload.startAt;
  const endAt = calcEndAt(startAt, service.durationMinutes);

  await ensureNoScheduleBlockConflict(payload.professionalId, startAt, endAt);

  const conflict = await findConflictingAppointment(payload.professionalId, startAt, endAt, id);

  if (conflict) throw new ConflictError(CONFLICT_MESSAGE);

  const appointment = await update(id, {
    clientId: payload.clientId,
    professionalId: payload.professionalId,
    serviceId: payload.serviceId,
    startAt,
    endAt,
    status: payload.status,
    notes: payload.notes,
  });

  if (appointment.status === APPOINTMENT_STATUS.CANCELED) {
    await cancelReminderForAppointment(appointment.id);
  } else {
    await recalculateReminderForAppointment(appointment);
  }

  const event =
    payload.status === APPOINTMENT_STATUS.CANCELED
      ? SOCKET_EVENTS.APPOINTMENT_CANCELED
      : SOCKET_EVENTS.APPOINTMENT_UPDATED;

  emitToAdmins(event, toAppointmentEventPayload(appointment));

  return appointment;
}

export async function updateAppointmentStatus(id, payload, actor) {
  const current = await findById(id);

  if (!current) throw new NotFoundError(NOT_FOUND_MESSAGE);

  await ensureEditAccess(actor, current);
  ensureEditableStatus(current, actor);

  const appointment = await updateStatus(id, payload.status);

  if (appointment.status === APPOINTMENT_STATUS.CANCELED) {
    await cancelReminderForAppointment(appointment.id);
  } else {
    await recalculateReminderForAppointment(appointment);
  }

  const event =
    payload.status === APPOINTMENT_STATUS.CANCELED
      ? SOCKET_EVENTS.APPOINTMENT_CANCELED
      : SOCKET_EVENTS.APPOINTMENT_UPDATED;

  emitToAdmins(event, toAppointmentEventPayload(appointment));

  return appointment;
}

export async function deleteAppointment(id) {
  const current = await findById(id);

  if (!current) throw new NotFoundError(NOT_FOUND_MESSAGE);

  await softDelete(id);
  await cancelReminderForAppointment(id);
}

export async function rescheduleAppointment(id, payload, actor, options = {}) {
  const businessDate = normalizeBusinessDate(payload.date);
  const businessTime = normalizeBusinessTime(payload.time);

  const appointment = await runAppointmentWriteTransaction(async (tx) => {
    const current = await findAppointmentForReschedule(id, tx);

    if (!current) {
      throw new NotFoundError(NOT_FOUND_MESSAGE);
    }

    await ensureEditAccess(actor, current, tx);
    ensureReschedulableStatus(current);

    if (!Number.isInteger(current.service?.durationMinutes) || current.service.durationMinutes <= 0) {
      throw new BadRequestError("Serviço do agendamento não encontrado.");
    }

    const nextProfessionalId = payload.professionalId ?? current.professionalId;

    const { startUtc, endUtc } = await assertAppointmentSlotAvailability({
      appointmentIdToIgnore: current.id,
      professionalId: nextProfessionalId,
      date: businessDate,
      time: businessTime,
      durationMinutes: current.service.durationMinutes,
      prismaOrTx: tx,
    });

    return updateAppointmentSchedule(
      current.id,
      {
        professionalId: nextProfessionalId,
        startAt: startUtc,
        endAt: endUtc,
      },
      tx,
    );
  });

  if (!options.skipSideEffects) {
    await recalculateReminderForAppointment(appointment);
    emitToAdmins(SOCKET_EVENTS.APPOINTMENT_UPDATED, toAppointmentEventPayload(appointment));
  }

  return appointment;
}

export async function getAvailability(query) {
  const { professionalId, serviceId, date } = query;

  const professional = await findProfessionalById(professionalId);

  if (!professional || professional.status !== USER_STATUS.ACTIVE) {
    throw new BadRequestError("Profissional não encontrado ou inativo.");
  }

  const service = await findServiceById(serviceId);

  if (!service || service.status !== SERVICE_STATUS.ACTIVE) {
    throw new BadRequestError("Serviço não encontrado ou inativo.");
  }

  const weekday = getWeekdayInBusinessZone(date);
  const [existing, scheduleBlocks, recurringBlocks, schedule, settingRows] = await Promise.all([
    listAppointmentsByDateAndProfessional(professionalId, date),
    listScheduleBlocksByDateAndProfessional(professionalId, date),
    listActiveRecurringBlocksForDay(professionalId, weekday),
    findActiveProfessionalScheduleByWeekday(professionalId, weekday),
    getSystemSettings(AGENDA_SETTINGS_KEYS),
  ]);

  const settings = toAvailabilitySettings(settingRows);
  const startTime = schedule?.openTime ?? settings.defaultOpenTime;
  const endTime = schedule?.closeTime ?? settings.defaultCloseTime;

  if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
    return { professionalId, serviceId, date, slots: [] };
  }

  const intervalMinutes = resolveAppointmentIntervalMinutes(professional, settings);

  const recurringBlockDateTimes = recurringBlocks.map((block) => ({
    startAt: combineBusinessDateAndTimeToUtc(date, block.startTime),
    endAt: combineBusinessDateAndTimeToUtc(date, block.endTime),
  }));

  const allBlocks = [...scheduleBlocks, ...recurringBlockDateTimes];

  const slots = generateSlots(
    date,
    service.durationMinutes,
    intervalMinutes,
    startTime,
    endTime,
    existing,
    allBlocks,
  );

  return { professionalId, serviceId, date, slots };
}
