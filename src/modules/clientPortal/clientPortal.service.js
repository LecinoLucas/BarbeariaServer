import { APPOINTMENT_STATUS } from "../../constants/appointmentStatus.js";
import { NOTIFICATION_TYPES } from "../../constants/notificationTypes.js";
import { SERVICE_STATUS } from "../../constants/serviceStatus.js";
import { BadRequestError } from "../../errors/BadRequestError.js";
import { ConflictError } from "../../errors/ConflictError.js";
import { ForbiddenError } from "../../errors/ForbiddenError.js";
import { NotFoundError } from "../../errors/NotFoundError.js";
import {
  emitNotificationToUser,
  emitToAdmins,
} from "../../socket/socket.emitter.js";
import { SOCKET_EVENTS } from "../../socket/socket.events.js";
import {
  cancelReminderForAppointment,
  recalculateReminderForAppointment,
} from "../appointmentReminders/appointmentReminder.service.js";
import {
  countAppointments,
  countAttendances,
  countFinishedAttendancesByPeriod,
  createNotification,
  findActiveProfessionalScheduleByWeekday,
  findAdmins,
  findAppointmentById,
  findByEmailIgnoringId,
  findByPhoneIgnoringId,
  findClientByUserId,
  findConflictingAppointment,
  findConflictingScheduleBlock,
  findServiceById,
  getFavoriteProfessional,
  getFavoriteService,
  getLastAttendance,
  getNextAppointment,
  getSettingByKey,
  listAppointments,
  listAttendances,
  sumPaidPaymentsByPeriod,
  updateAppointmentDate,
  updateAppointmentStatus,
  updateClientProfile,
} from "./clientPortal.repository.js";

const CLIENT_PROFILE_NOT_FOUND_MESSAGE = "Perfil de cliente não encontrado.";
const APPOINTMENT_NOT_FOUND_MESSAGE = "Agendamento não encontrado.";
const DUPLICATE_PHONE_MESSAGE = "Já existe um cliente não deletado com este telefone.";
const DUPLICATE_EMAIL_MESSAGE = "Já existe um cliente não deletado com este email.";
const SCHEDULE_BLOCK_CONFLICT_MESSAGE = "Horário bloqueado para o profissional selecionado.";
const APPOINTMENT_CONFLICT_MESSAGE = "Conflito de horário para o profissional selecionado.";

const DEFAULT_OPEN_TIME = "09:00";
const DEFAULT_CLOSE_TIME = "18:00";
const DEFAULT_ALLOW_CLIENT_CANCEL = true;
const DEFAULT_ALLOW_CLIENT_RESCHEDULE = true;

function normalizePhone(phone) {
  return phone.trim();
}

function normalizeEmail(email) {
  return email ? email.trim().toLowerCase() : null;
}

function roundToTwo(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function calcEndAt(startAt, durationMinutes) {
  return new Date(startAt.getTime() + durationMinutes * 60 * 1000);
}

function getDateRanges(now) {
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const endOfYear = new Date(now.getFullYear() + 1, 0, 1);

  return {
    startOfMonth,
    endOfMonth,
    startOfYear,
    endOfYear,
  };
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function buildDateTime(date, time) {
  return new Date(`${date}T${time}:00.000Z`);
}

function getWeekdayFromDate(date) {
  return date.getUTCDay();
}

function toAppointmentEventPayload(appointment) {
  return {
    id: appointment.id,
    startAt: appointment.startAt,
    endAt: appointment.endAt,
    status: appointment.status,
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
  };
}

async function ensureClientProfile(userId) {
  const client = await findClientByUserId(userId);

  if (!client) {
    throw new NotFoundError(CLIENT_PROFILE_NOT_FOUND_MESSAGE);
  }

  return client;
}

async function ensureOwnAppointment(appointmentId, clientId) {
  const appointment = await findAppointmentById(appointmentId);

  if (!appointment) {
    throw new NotFoundError(APPOINTMENT_NOT_FOUND_MESSAGE);
  }

  if (appointment.clientId !== clientId) {
    throw new ForbiddenError("Acesso negado.");
  }

  return appointment;
}

async function ensurePhoneAvailable(phone, ignoringId) {
  const normalizedPhone = normalizePhone(phone);
  const existingClient = await findByPhoneIgnoringId(normalizedPhone, ignoringId);

  if (existingClient) {
    throw new ConflictError(DUPLICATE_PHONE_MESSAGE);
  }

  return normalizedPhone;
}

async function ensureEmailAvailable(email, ignoringId) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return null;
  }

  const existingClient = await findByEmailIgnoringId(normalizedEmail, ignoringId);

  if (existingClient) {
    throw new ConflictError(DUPLICATE_EMAIL_MESSAGE);
  }

  return normalizedEmail;
}

async function ensureClientCancelAllowed() {
  const setting = await getSettingByKey("allow_client_cancel");
  const isAllowed = setting ? setting.value === "true" : DEFAULT_ALLOW_CLIENT_CANCEL;

  if (!isAllowed) {
    throw new ForbiddenError("Cancelamento pelo cliente está desabilitado.");
  }
}

async function ensureClientRescheduleAllowed() {
  const setting = await getSettingByKey("allow_client_reschedule");
  const isAllowed = setting ? setting.value === "true" : DEFAULT_ALLOW_CLIENT_RESCHEDULE;

  if (!isAllowed) {
    throw new ForbiddenError("Reagendamento pelo cliente está desabilitado.");
  }
}

function ensureAppointentCanBeManagedByClient(appointment) {
  if (
    appointment.status !== APPOINTMENT_STATUS.SCHEDULED &&
    appointment.status !== APPOINTMENT_STATUS.CONFIRMED
  ) {
    throw new BadRequestError(
      "O cliente só pode alterar agendamentos agendados ou confirmados.",
    );
  }
}

async function ensureNoScheduleBlockConflict(professionalId, startAt, endAt) {
  const block = await findConflictingScheduleBlock(professionalId, startAt, endAt);

  if (block) {
    throw new ConflictError(SCHEDULE_BLOCK_CONFLICT_MESSAGE);
  }
}

async function ensureNoAppointmentConflict(professionalId, startAt, endAt, ignoringId) {
  const conflict = await findConflictingAppointment(
    professionalId,
    startAt,
    endAt,
    ignoringId,
  );

  if (conflict) {
    throw new ConflictError(APPOINTMENT_CONFLICT_MESSAGE);
  }
}

async function ensureWithinProfessionalSchedule(professionalId, startAt, endAt) {
  const dateKey = startAt.toISOString().slice(0, 10);
  const weekday = getWeekdayFromDate(startAt);

  const [schedule, defaultOpenTimeSetting, defaultCloseTimeSetting] = await Promise.all([
    findActiveProfessionalScheduleByWeekday(professionalId, weekday),
    getSettingByKey("default_open_time"),
    getSettingByKey("default_close_time"),
  ]);

  const openTime = schedule?.openTime ?? defaultOpenTimeSetting?.value ?? DEFAULT_OPEN_TIME;
  const closeTime =
    schedule?.closeTime ?? defaultCloseTimeSetting?.value ?? DEFAULT_CLOSE_TIME;

  const workStart = buildDateTime(dateKey, openTime);
  const workEnd = buildDateTime(dateKey, closeTime);

  if (startAt < workStart || endAt > workEnd) {
    throw new BadRequestError("Horário fora da agenda do profissional.");
  }
}

async function createAdminNotifications(payload) {
  const admins = await findAdmins();

  if (admins.length === 0) {
    return;
  }

  await Promise.all(
    admins.map(async (admin) => {
      const notification = await createNotification({
        userId: admin.id,
        title: payload.title,
        message: payload.message,
        type: payload.type,
        metadata: payload.metadata ?? null,
      });

      emitNotificationToUser(admin.id, notification);
    }),
  );
}

export async function getClientDashboard(userId) {
  const client = await ensureClientProfile(userId);
  const now = new Date();
  const { startOfMonth, endOfMonth, startOfYear, endOfYear } = getDateRanges(now);

  const [
    nextAppointment,
    lastAttendance,
    cutsThisMonth,
    cutsThisYear,
    spentThisMonth,
    spentThisYear,
    favoriteProfessional,
    favoriteService,
  ] = await Promise.all([
    getNextAppointment(client.id, now),
    getLastAttendance(client.id),
    countFinishedAttendancesByPeriod(client.id, startOfMonth, endOfMonth),
    countFinishedAttendancesByPeriod(client.id, startOfYear, endOfYear),
    sumPaidPaymentsByPeriod(client.id, startOfMonth, endOfMonth),
    sumPaidPaymentsByPeriod(client.id, startOfYear, endOfYear),
    getFavoriteProfessional(client.id),
    getFavoriteService(client.id),
  ]);

  return {
    nextAppointment,
    lastAttendance,
    cutsThisMonth,
    cutsThisYear,
    spentThisMonth: roundToTwo(spentThisMonth),
    spentThisYear: roundToTwo(spentThisYear),
    favoriteProfessional: favoriteProfessional
      ? {
          professionalId: favoriteProfessional.professionalId,
          name: favoriteProfessional.name,
          attendances: Number(favoriteProfessional.attendances ?? 0),
        }
      : null,
    favoriteService: favoriteService
      ? {
          serviceId: favoriteService.serviceId,
          name: favoriteService.name,
          quantity: Number(favoriteService.quantity ?? 0),
        }
      : null,
  };
}

export async function listClientAppointments(query, userId) {
  const client = await ensureClientProfile(userId);
  const [items, total] = await Promise.all([
    listAppointments(client.id, query),
    countAppointments(client.id, query),
  ]);

  return {
    items,
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  };
}

export async function listClientAttendances(query, userId) {
  const client = await ensureClientProfile(userId);
  const [items, total] = await Promise.all([
    listAttendances(client.id, query),
    countAttendances(client.id, query),
  ]);

  return {
    items,
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  };
}

export async function getClientProfile(userId) {
  return ensureClientProfile(userId);
}

export async function updateOwnClientProfile(payload, userId) {
  const client = await ensureClientProfile(userId);
  const phone = await ensurePhoneAvailable(payload.phone, client.id);
  const email = await ensureEmailAvailable(payload.email, client.id);

  return updateClientProfile(client.id, {
    name: payload.name.trim(),
    phone,
    email,
    birthDate: payload.birthDate,
    notes: payload.notes,
  });
}

export async function cancelOwnAppointment(appointmentId, userId) {
  const client = await ensureClientProfile(userId);
  await ensureClientCancelAllowed();

  const appointment = await ensureOwnAppointment(appointmentId, client.id);
  ensureAppointentCanBeManagedByClient(appointment);

  const updatedAppointment = await updateAppointmentStatus(
    appointment.id,
    APPOINTMENT_STATUS.CANCELED,
  );

  await cancelReminderForAppointment(updatedAppointment.id);

  await createAdminNotifications({
    title: "Agendamento cancelado",
    message: `${client.name} cancelou um agendamento.`,
    type: NOTIFICATION_TYPES.APPOINTMENT_CANCELED,
    metadata: {
      appointmentId: updatedAppointment.id,
      clientId: client.id,
    },
  });

  emitToAdmins(
    SOCKET_EVENTS.APPOINTMENT_CANCELED,
    toAppointmentEventPayload(updatedAppointment),
  );

  return updatedAppointment;
}

export async function rescheduleOwnAppointment(appointmentId, payload, userId) {
  const client = await ensureClientProfile(userId);
  await ensureClientRescheduleAllowed();

  const appointment = await ensureOwnAppointment(appointmentId, client.id);
  ensureAppointentCanBeManagedByClient(appointment);

  const service = await findServiceById(appointment.serviceId);

  if (!service || service.status !== SERVICE_STATUS.ACTIVE) {
    throw new BadRequestError("Serviço não encontrado ou inativo.");
  }

  const startAt = payload.startAt;
  const endAt = calcEndAt(startAt, service.durationMinutes);

  await ensureWithinProfessionalSchedule(appointment.professionalId, startAt, endAt);
  await ensureNoScheduleBlockConflict(appointment.professionalId, startAt, endAt);
  await ensureNoAppointmentConflict(
    appointment.professionalId,
    startAt,
    endAt,
    appointment.id,
  );

  const updatedAppointment = await updateAppointmentDate(appointment.id, startAt, endAt);

  await recalculateReminderForAppointment(updatedAppointment);

  await createAdminNotifications({
    title: "Agendamento reagendado",
    message: `${client.name} reagendou um agendamento.`,
    type: NOTIFICATION_TYPES.APPOINTMENT_UPDATED,
    metadata: {
      appointmentId: updatedAppointment.id,
      clientId: client.id,
      startAt: updatedAppointment.startAt,
      endAt: updatedAppointment.endAt,
    },
  });

  emitToAdmins(
    SOCKET_EVENTS.APPOINTMENT_UPDATED,
    toAppointmentEventPayload(updatedAppointment),
  );

  return updatedAppointment;
}
