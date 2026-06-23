import { NOTIFICATION_TYPES } from "../../constants/notificationTypes.js";
import {
  emitNotificationToAdmins,
  emitNotificationToUser,
  emitToAdmins,
} from "../../socket/socket.emitter.js";
import { SOCKET_EVENTS } from "../../socket/socket.events.js";
import {
  createNotification,
  findAdmins,
  findExistingReminderNotification,
  findUpcomingAppointments,
  getSettingByKey,
} from "./reminder.repository.js";

const DEFAULT_REMINDER_MINUTES = 15;
const REMINDER_SETTING_KEY = "appointment_reminder_minutes";

function getReminderMinutes(setting) {
  const parsedMinutes = Number(setting?.value);

  if (!Number.isInteger(parsedMinutes) || parsedMinutes <= 0) {
    return DEFAULT_REMINDER_MINUTES;
  }

  return parsedMinutes;
}

function buildReminderPayload(appointment) {
  const timeFormatted = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(appointment.startAt));

  return {
    appointmentId: appointment.id,
    clientId: appointment.clientId,
    clientName: appointment.client?.name,
    professionalId: appointment.professionalId,
    professionalName: appointment.professional?.name,
    serviceId: appointment.serviceId,
    startAt: appointment.startAt,
    time: timeFormatted,
  };
}

function buildReminderMessage(appointment) {
  return `O agendamento de ${appointment.client.name} começa em breve.`;
}

function buildReminderEventPayload(appointment, minutes) {
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
    status: appointment.status,
    minutes,
  };
}

export async function processAppointmentReminders() {
  const setting = await getSettingByKey(REMINDER_SETTING_KEY);
  const minutes = getReminderMinutes(setting);
  const now = new Date();
  const windowEnd = new Date(now.getTime() + minutes * 60 * 1000);

  const [appointments, admins] = await Promise.all([
    findUpcomingAppointments(now, windowEnd),
    findAdmins(),
  ]);

  if (appointments.length === 0 || admins.length === 0) {
    return {
      processed: 0,
      created: 0,
    };
  }

  let createdCount = 0;

  for (const appointment of appointments) {
    const eventPayload = buildReminderEventPayload(appointment, minutes);
    let shouldEmitAdminRoom = false;

    for (const admin of admins) {
      const existingNotification = await findExistingReminderNotification(admin.id, appointment.id);

      if (existingNotification) {
        continue;
      }

      const notification = await createNotification({
        userId: admin.id,
        title: "Agendamento próximo",
        message: buildReminderMessage(appointment),
        type: NOTIFICATION_TYPES.APPOINTMENT_REMINDER,
        metadata: buildReminderPayload(appointment),
      });

      emitNotificationToUser(admin.id, notification);

      if (!shouldEmitAdminRoom) {
        emitNotificationToAdmins(notification);
        shouldEmitAdminRoom = true;
      }

      createdCount += 1;
    }

    if (shouldEmitAdminRoom) {
      emitToAdmins(SOCKET_EVENTS.APPOINTMENT_REMINDER, eventPayload);
    }
  }

  return {
    processed: appointments.length,
    created: createdCount,
  };
}
