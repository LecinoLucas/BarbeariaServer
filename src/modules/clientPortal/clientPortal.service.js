import { APPOINTMENT_STATUS } from "../../constants/appointmentStatus.js";
import { NOTIFICATION_TYPES } from "../../constants/notificationTypes.js";
import { SERVICE_STATUS } from "../../constants/serviceStatus.js";
import { BadRequestError } from "../../errors/BadRequestError.js";
import { ConflictError } from "../../errors/ConflictError.js";
import { ForbiddenError } from "../../errors/ForbiddenError.js";
import { NotFoundError } from "../../errors/NotFoundError.js";
import { ServiceUnavailableError } from "../../errors/ServiceUnavailableError.js";
import {
  emitNotificationToUser,
  emitToAdmins,
} from "../../socket/socket.emitter.js";
import { SOCKET_EVENTS } from "../../socket/socket.events.js";
import {
  buildAppointmentCanceledMessage,
  buildAppointmentCreatedMessage,
  buildAppointmentNotificationMetadata,
  buildAppointmentRescheduledMessage,
} from "../../utils/appointmentNotificationFormatter.js";
import {
  combineBusinessDateAndTimeToUtc,
  getBusinessDateKeyFromUtc,
  getBusinessTimeFromUtc,
} from "../../utils/agendaTimezone.js";
import {
  assertAppointmentSlotAvailability,
  getAvailability as getAppointmentAvailability,
} from "../appointments/appointment.service.js";
import { findActiveClientServiceAppointment } from "../appointments/appointment.repository.js";
import {
  cancelReminderForAppointment,
  createReminderForAppointment,
  recalculateReminderForAppointment,
} from "../appointmentReminders/appointmentReminder.service.js";
import { getClientPortalSettings as getClientPortalSettingsRuntime } from "../settings/settings.service.js";
import {
  countAllAppointments,
  countActiveClientAppointments,
  countAllFinishedAttendances,
  countAppointments,
  countAttendances,
  countFinishedAttendancesByPeriod,
  createClientPortalAppointment,
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
  getLastAttendance,
  getNextAppointment,
  getSettingByKey,
  listHistoricalClientAppointments,
  listAppointments,
  listActiveClientPortalProfessionals,
  listActiveClientPortalServices,
  listAttendances,
  listRecentAttendances,
  listUpcomingClientAppointments,
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
const BOOKING_ADVANCE_MESSAGE = "Este horário precisa ser agendado com mais antecedência.";
const BOOKING_MAX_DAYS_MESSAGE =
  "Escolha uma data dentro do período permitido para agendamento online.";
const BOOKING_ACTIVE_LIMIT_MESSAGE =
  "Você já possui o limite de agendamentos ativos permitido.";

const DEFAULT_OPEN_TIME = "09:00";
const DEFAULT_CLOSE_TIME = "18:00";
const CLIENT_PORTAL_STATUS_LABELS = {
  [APPOINTMENT_STATUS.SCHEDULED]: "Agendado",
  [APPOINTMENT_STATUS.CONFIRMED]: "Confirmado",
  [APPOINTMENT_STATUS.IN_ATTENDANCE]: "Em atendimento",
  [APPOINTMENT_STATUS.FINISHED]: "Finalizado",
  [APPOINTMENT_STATUS.CANCELED]: "Cancelado",
  [APPOINTMENT_STATUS.NO_SHOW]: "Não compareceu",
};

function normalizePhone(phone) {
  return phone.trim();
}

function normalizeEmail(email) {
  return email ? email.trim().toLowerCase() : null;
}

function calcEndAt(startAt, durationMinutes) {
  return new Date(startAt.getTime() + durationMinutes * 60 * 1000);
}

function getDateRanges(now) {
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return {
    startOfMonth,
    endOfMonth,
  };
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function buildDateTime(date, time) {
  return new Date(`${date}T${time}:00.000Z`);
}

function addDaysToDateKey(dateKey, days) {
  const baseDate = new Date(`${dateKey}T00:00:00.000Z`);
  baseDate.setUTCDate(baseDate.getUTCDate() + days);
  return baseDate.toISOString().slice(0, 10);
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

function getAppointmentStatusLabel(status) {
  return CLIENT_PORTAL_STATUS_LABELS[status] ?? "Status desconhecido";
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

async function ensureClientRescheduleAllowed() {
  const setting = await getSettingByKey("allow_client_reschedule");
  const isAllowed = setting ? setting.value === "true" : true;

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

function canClientCancelAppointment(appointment, config, now = new Date()) {
  if (!config.cancelEnabled) {
    return false;
  }

  if (!appointment?.startAt || appointment.startAt <= now) {
    return false;
  }

  const matchesStatus =
    appointment.status === APPOINTMENT_STATUS.SCHEDULED ||
    appointment.status === APPOINTMENT_STATUS.CONFIRMED;

  if (!matchesStatus) {
    return false;
  }

  if (config.cancelMinHours <= 0) {
    return true;
  }

  const minMilliseconds = config.cancelMinHours * 60 * 60 * 1000;
  return appointment.startAt.getTime() - now.getTime() >= minMilliseconds;
}

function ensureAppointmentCanBeCanceledByClient(appointment, config) {
  if (!config.cancelEnabled) {
    throw new ServiceUnavailableError("O cancelamento online está temporariamente indisponível.");
  }

  if (!canClientCancelAppointment(appointment, config)) {
    throw new BadRequestError("Este agendamento não pode ser cancelado.");
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

function formatAttendanceForDashboard(attendance) {
  const date = getBusinessDateKeyFromUtc(attendance.startedAt);
  const time = getBusinessTimeFromUtc(attendance.startedAt);
  const services =
    attendance.items.length > 0
      ? attendance.items.map((item) => item.service.name)
      : attendance.appointment?.service?.name
        ? [attendance.appointment.service.name]
        : [];

  return {
    id: attendance.appointmentId ?? attendance.id,
    date,
    time,
    professionalName: attendance.professional?.name ?? null,
    services,
    status: attendance.status,
  };
}

function formatAppointmentForDashboard(appointment) {
  const date = getBusinessDateKeyFromUtc(appointment.startAt);
  const time = getBusinessTimeFromUtc(appointment.startAt);

  return {
    id: appointment.id,
    date,
    time,
    professionalName: appointment.professional?.name ?? null,
    services: appointment.service?.name ? [appointment.service.name] : [],
    status: appointment.status,
  };
}

function toPriceCents(price) {
  if (price === null || price === undefined) {
    return null;
  }

  return Math.round(Number(price) * 100);
}

function formatCreatedAppointment(appointment) {
  return {
    id: appointment.id,
    date: getBusinessDateKeyFromUtc(appointment.startAt),
    time: getBusinessTimeFromUtc(appointment.startAt),
    status: appointment.status,
    professionalName: appointment.professional?.name ?? null,
    serviceName: appointment.service?.name ?? null,
  };
}

function formatCreatedAppointmentWithConfig(appointment, config) {
  return {
    ...formatCreatedAppointment(appointment),
    professionalName: config.showProfessional ? appointment.professional?.name ?? null : null,
  };
}

function formatClientPortalAppointment(appointment, config, now = new Date()) {
  return {
    id: appointment.id,
    date: getBusinessDateKeyFromUtc(appointment.startAt),
    time: getBusinessTimeFromUtc(appointment.startAt),
    status: appointment.status,
    statusLabel: getAppointmentStatusLabel(appointment.status),
    professionalName: config.showProfessional ? appointment.professional?.name ?? null : null,
    services: appointment.service?.name ? [appointment.service.name] : [],
    canCancel: canClientCancelAppointment(appointment, config, now),
  };
}

function formatDashboardAttendance(attendance, config) {
  const formatted = formatAttendanceForDashboard(attendance);
  return {
    ...formatted,
    professionalName: config.showProfessional ? formatted.professionalName : null,
  };
}

function formatDashboardAppointment(appointment, config) {
  const formatted = formatAppointmentForDashboard(appointment);
  return {
    ...formatted,
    professionalName: config.showProfessional ? formatted.professionalName : null,
  };
}

function ensureDateWithinBookingWindow(date, config, now = new Date()) {
  if (config.bookingMaxDaysAhead < 0) {
    return;
  }

  const todayKey = getBusinessDateKeyFromUtc(now);
  const maxDateKey = addDaysToDateKey(todayKey, config.bookingMaxDaysAhead);

  if (date < todayKey || date > maxDateKey) {
    throw new BadRequestError(BOOKING_MAX_DAYS_MESSAGE);
  }
}

function ensureBookingAdvance(startAt, config, now = new Date()) {
  if (config.bookingMinHoursAdvance <= 0) {
    return;
  }

  const minMilliseconds = config.bookingMinHoursAdvance * 60 * 60 * 1000;

  if (startAt.getTime() - now.getTime() < minMilliseconds) {
    throw new BadRequestError(BOOKING_ADVANCE_MESSAGE);
  }
}

function normalizeClientPortalNotes(notes, config) {
  if (!config.notesEnabled) {
    return null;
  }

  const normalized = typeof notes === "string" ? notes.trim() : "";

  if (config.notesRequired && normalized.length === 0) {
    throw new BadRequestError("Preencha a observação para continuar.");
  }

  return normalized.length > 0 ? normalized : null;
}

export async function getClientPortalConfig() {
  return getClientPortalSettingsRuntime();
}

export async function getClientDashboard(userId) {
  const client = await ensureClientProfile(userId);
  const config = await getClientPortalSettingsRuntime();
  const now = new Date();
  const { startOfMonth, endOfMonth } = getDateRanges(now);

  const [
    nextAppointment,
    lastAttendance,
    appointmentsThisMonth,
    totalAppointments,
    completedAppointments,
    recentHistory,
  ] = await Promise.all([
    config.dashboardShowNextAppointment ? getNextAppointment(client.id, now) : Promise.resolve(null),
    config.dashboardShowLastVisit ? getLastAttendance(client.id) : Promise.resolve(null),
    countFinishedAttendancesByPeriod(client.id, startOfMonth, endOfMonth),
    countAllAppointments(client.id),
    countAllFinishedAttendances(client.id),
    config.dashboardShowRecentHistory
      ? listRecentAttendances(client.id, config.dashboardHistoryLimit)
      : Promise.resolve([]),
  ]);

  return {
    summary: {
      totalAppointments,
      completedAppointments,
      appointmentsThisMonth,
    },
    lastVisit: lastAttendance ? formatDashboardAttendance(lastAttendance, config) : null,
    nextAppointment: nextAppointment ? formatDashboardAppointment(nextAppointment, config) : null,
    recentHistory: recentHistory
      .slice(0, config.dashboardHistoryLimit)
      .map((item) => formatDashboardAttendance(item, config)),
  };
}

export async function listClientPortalServices(userId) {
  await ensureClientProfile(userId);
  const config = await getClientPortalSettingsRuntime();

  const items = await listActiveClientPortalServices();

  return {
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description ?? null,
      durationMinutes: config.showDuration ? item.durationMinutes : null,
      priceCents: config.showPrices ? toPriceCents(item.price) : null,
    })),
  };
}

export async function listClientPortalProfessionals(userId) {
  await ensureClientProfile(userId);

  const items = await listActiveClientPortalProfessionals();

  return {
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      specialty: item.specialty ?? null,
      photoUrl: null,
    })),
  };
}

export async function getClientPortalAvailability(query, userId) {
  await ensureClientProfile(userId);
  const config = await getClientPortalSettingsRuntime();
  const now = new Date();

  ensureDateWithinBookingWindow(query.date, config, now);

  const result = await getAppointmentAvailability(query);
  const filteredSlots = result.slots.filter((slot) => {
    if (config.bookingMinHoursAdvance <= 0) {
      return true;
    }

    const minMilliseconds = config.bookingMinHoursAdvance * 60 * 60 * 1000;
    return new Date(slot.startAt).getTime() - now.getTime() >= minMilliseconds;
  });

  return {
    date: result.date,
    professionalId: result.professionalId,
    serviceId: result.serviceId,
    slots: filteredSlots.map((slot) => ({
      time: getBusinessTimeFromUtc(new Date(slot.startAt)),
      available: true,
    })),
  };
}

export async function createOwnClientAppointment(payload, userId) {
  const client = await ensureClientProfile(userId);
  const config = await getClientPortalSettingsRuntime();

  if (!config.bookingEnabled) {
    throw new ServiceUnavailableError("O agendamento online está temporariamente indisponível.");
  }

  const service = await findServiceById(payload.serviceId);

  if (!service || service.status !== SERVICE_STATUS.ACTIVE) {
    throw new BadRequestError("Serviço não encontrado ou inativo.");
  }

  ensureDateWithinBookingWindow(payload.date, config);

  const existingAppointment = await findActiveClientServiceAppointment(client.id, payload.serviceId);

  if (existingAppointment) {
    throw new ConflictError("Você já possui um agendamento ativo para este serviço.");
  }

  const activeAppointmentsCount = await countActiveClientAppointments(client.id);

  if (activeAppointmentsCount >= config.maxActiveAppointments) {
    throw new ConflictError(BOOKING_ACTIVE_LIMIT_MESSAGE);
  }

  const requestedStartAt = combineBusinessDateAndTimeToUtc(payload.date, payload.time);

  if (requestedStartAt <= new Date()) {
    throw new BadRequestError("Não é possível criar agendamento em horário passado.");
  }

  ensureBookingAdvance(requestedStartAt, config);

  const normalizedNotes = normalizeClientPortalNotes(payload.notes, config);

  const { startUtc, endUtc } = await assertAppointmentSlotAvailability({
    professionalId: payload.professionalId,
    date: payload.date,
    time: payload.time,
    durationMinutes: service.durationMinutes,
  });

  const appointment = await createClientPortalAppointment({
    clientId: client.id,
    professionalId: payload.professionalId,
    serviceId: payload.serviceId,
    startAt: startUtc,
    endAt: endUtc,
    status: APPOINTMENT_STATUS.SCHEDULED,
    notes: normalizedNotes,
  });

  await createReminderForAppointment(appointment);

  await createAdminNotifications({
    title: "Novo agendamento",
    message: buildAppointmentCreatedMessage(appointment),
    type: NOTIFICATION_TYPES.APPOINTMENT_CREATED,
    metadata: buildAppointmentNotificationMetadata(appointment, {
      clientId: client.id,
    }),
  });

  emitToAdmins(SOCKET_EVENTS.APPOINTMENT_CREATED, toAppointmentEventPayload(appointment));

  return {
    appointment: formatCreatedAppointmentWithConfig(appointment, config),
  };
}

export async function listClientAppointments(query, userId) {
  const client = await ensureClientProfile(userId);
  const config = await getClientPortalSettingsRuntime();
  const now = new Date();
  let items = [];
  let total = 0;

  if (query.status) {
    [items, total] = await Promise.all([
      listAppointments(client.id, query),
      countAppointments(client.id, query),
    ]);
  } else {
    const upcomingLimit = Math.max(query.limit, config.appointmentsHistoryLimit, 20);
    const [upcomingItems, historicalItems] = await Promise.all([
      listUpcomingClientAppointments(client.id, now, upcomingLimit),
      config.appointmentsShowHistory
        ? listHistoricalClientAppointments(client.id, now, config.appointmentsHistoryLimit)
        : Promise.resolve([]),
    ]);

    items = [...upcomingItems, ...historicalItems];
    total = items.length;
  }

  return {
    items: items.map((item) => formatClientPortalAppointment(item, config, now)),
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
  const config = await getClientPortalSettingsRuntime();

  const appointment = await ensureOwnAppointment(appointmentId, client.id);
  ensureAppointmentCanBeCanceledByClient(appointment, config);

  const updatedAppointment = await updateAppointmentStatus(
    appointment.id,
    APPOINTMENT_STATUS.CANCELED,
  );

  await cancelReminderForAppointment(updatedAppointment.id);

  await createAdminNotifications({
    title: "Agendamento cancelado",
    message: buildAppointmentCanceledMessage(client.name, updatedAppointment),
    type: NOTIFICATION_TYPES.APPOINTMENT_CANCELED,
    metadata: buildAppointmentNotificationMetadata(updatedAppointment, {
      clientId: client.id,
    }),
  });

  emitToAdmins(
    SOCKET_EVENTS.APPOINTMENT_CANCELED,
    toAppointmentEventPayload(updatedAppointment),
  );

  return {
    appointment: {
      id: updatedAppointment.id,
      status: updatedAppointment.status,
      statusLabel: getAppointmentStatusLabel(updatedAppointment.status),
    },
  };
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
    message: buildAppointmentRescheduledMessage(client.name, updatedAppointment),
    type: NOTIFICATION_TYPES.APPOINTMENT_UPDATED,
    metadata: buildAppointmentNotificationMetadata(updatedAppointment, {
      clientId: client.id,
      endAt: updatedAppointment.endAt,
    }),
  });

  emitToAdmins(
    SOCKET_EVENTS.APPOINTMENT_UPDATED,
    toAppointmentEventPayload(updatedAppointment),
  );

  return updatedAppointment;
}
