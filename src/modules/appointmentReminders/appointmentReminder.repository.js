import prisma from "../../database/prisma.js";
import { NOTIFICATION_TYPES } from "../../constants/notificationTypes.js";
import { REMINDER_STATUSES } from "../../constants/reminderStatus.js";

const REMINDER_SETTING_KEYS = [
  "barbershop_name",
  "appointment_reminder_enabled",
  "appointment_reminder_email_enabled",
  "appointment_reminder_minutes",
];

const reminderSelect = {
  id: true,
  appointmentId: true,
  channel: true,
  scheduledAt: true,
  status: true,
  sentAt: true,
  attempts: true,
  maxAttempts: true,
  lastError: true,
  idempotencyKey: true,
  createdAt: true,
  updatedAt: true,
  appointment: {
    select: {
      id: true,
      clientId: true,
      professionalId: true,
      serviceId: true,
      startAt: true,
      endAt: true,
      status: true,
      deletedAt: true,
      client: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      professional: {
        select: {
          id: true,
          userId: true,
          name: true,
          user: {
            select: {
              id: true,
              status: true,
              deletedAt: true,
            },
          },
        },
      },
      service: {
        select: {
          id: true,
          name: true,
          durationMinutes: true,
          price: true,
        },
      },
    },
  },
};

const reminderListSelect = {
  id: true,
  appointmentId: true,
  channel: true,
  scheduledAt: true,
  status: true,
  sentAt: true,
  attempts: true,
  maxAttempts: true,
  lastError: true,
  idempotencyKey: true,
  createdAt: true,
  updatedAt: true,
  appointment: {
    select: {
      id: true,
      startAt: true,
      endAt: true,
      status: true,
      client: {
        select: {
          id: true,
          name: true,
        },
      },
      professional: {
        select: {
          id: true,
          name: true,
          userId: true,
        },
      },
      service: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
};

const notificationSelect = {
  id: true,
  userId: true,
  title: true,
  message: true,
  type: true,
  readAt: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
};

function buildListWhere(filters) {
  const where = {};

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.channel) {
    where.channel = filters.channel;
  }

  if (filters.appointmentId) {
    where.appointmentId = filters.appointmentId;
  }

  if (filters.professionalId) {
    where.appointment = {
      professionalId: filters.professionalId,
    };
  }

  return where;
}

export function getReminderSettings() {
  return prisma.systemSetting.findMany({
    where: {
      key: {
        in: REMINDER_SETTING_KEYS,
      },
    },
    select: {
      key: true,
      value: true,
    },
  });
}

export function createReminder(data) {
  return prisma.appointmentReminder.create({
    data,
    select: reminderSelect,
  });
}

export function findReminderByIdempotencyKey(idempotencyKey) {
  if (!idempotencyKey) {
    return null;
  }

  return prisma.appointmentReminder.findUnique({
    where: { idempotencyKey },
    select: reminderSelect,
  });
}

export function reactivateReminder(id) {
  return prisma.appointmentReminder.update({
    where: { id },
    data: {
      status: REMINDER_STATUSES.PENDING,
      sentAt: null,
      attempts: 0,
      lastError: null,
    },
    select: reminderSelect,
  });
}

export function cancelOutdatedReminders(appointmentId, channel, keepIdempotencyKey) {
  return prisma.appointmentReminder.updateMany({
    where: {
      appointmentId,
      channel,
      status: {
        in: [REMINDER_STATUSES.PENDING, REMINDER_STATUSES.FAILED],
      },
      idempotencyKey: {
        not: keepIdempotencyKey,
      },
    },
    data: {
      status: REMINDER_STATUSES.CANCELED,
      lastError: "Lembrete substituído por uma nova programação.",
    },
  });
}

export function cancelPendingRemindersByAppointmentId(appointmentId, reason) {
  return prisma.appointmentReminder.updateMany({
    where: {
      appointmentId,
      status: {
        in: [REMINDER_STATUSES.PENDING, REMINDER_STATUSES.FAILED],
      },
    },
    data: {
      status: REMINDER_STATUSES.CANCELED,
      lastError: reason ?? "Lembrete cancelado.",
    },
  });
}

export function listDuePendingReminders(now, limit) {
  return prisma.appointmentReminder.findMany({
    where: {
      status: REMINDER_STATUSES.PENDING,
      scheduledAt: {
        lte: now,
      },
    },
    orderBy: [
      {
        scheduledAt: "asc",
      },
      {
        createdAt: "asc",
      },
    ],
    take: limit,
    select: {
      id: true,
    },
  });
}

export async function claimReminder(id) {
  const result = await prisma.appointmentReminder.updateMany({
    where: {
      id,
      status: REMINDER_STATUSES.PENDING,
    },
    data: {
      status: REMINDER_STATUSES.PROCESSING,
      lastError: null,
    },
  });

  return result.count === 1;
}

export function findReminderById(id) {
  if (!id) {
    return null;
  }

  return prisma.appointmentReminder.findUnique({
    where: { id },
    select: reminderSelect,
  });
}

export async function createNotificationAndMarkSent(reminderId, notificationData) {
  const [notification, reminder] = await prisma.$transaction([
    prisma.notification.create({
      data: {
        ...notificationData,
        type: NOTIFICATION_TYPES.APPOINTMENT_REMINDER,
      },
      select: notificationSelect,
    }),
    prisma.appointmentReminder.update({
      where: { id: reminderId },
      data: {
        status: REMINDER_STATUSES.SENT,
        sentAt: new Date(),
        lastError: null,
      },
      select: reminderSelect,
    }),
  ]);

  return { notification, reminder };
}

export function markReminderAsSent(id) {
  return prisma.appointmentReminder.update({
    where: { id },
    data: {
      status: REMINDER_STATUSES.SENT,
      sentAt: new Date(),
      lastError: null,
    },
    select: reminderSelect,
  });
}

export function updateReminderAfterFailure(id, data) {
  return prisma.appointmentReminder.update({
    where: { id },
    data,
    select: reminderSelect,
  });
}

export function cancelReminder(id, reason) {
  return prisma.appointmentReminder.update({
    where: { id },
    data: {
      status: REMINDER_STATUSES.CANCELED,
      lastError: reason ?? "Lembrete cancelado.",
    },
    select: reminderSelect,
  });
}

export function findProfessionalByUserId(userId) {
  if (!userId) {
    return null;
  }

  return prisma.professional.findFirst({
    where: {
      userId,
      deletedAt: null,
    },
    select: {
      id: true,
      userId: true,
    },
  });
}

export function listReminders(filters) {
  return prisma.appointmentReminder.findMany({
    where: buildListWhere(filters),
    orderBy: [
      {
        scheduledAt: "desc",
      },
      {
        createdAt: "desc",
      },
    ],
    skip: (filters.page - 1) * filters.limit,
    take: filters.limit,
    select: reminderListSelect,
  });
}

export function countReminders(filters) {
  return prisma.appointmentReminder.count({
    where: buildListWhere(filters),
  });
}
