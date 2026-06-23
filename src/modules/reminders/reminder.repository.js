import prisma from "../../database/prisma.js";
import { ROLES } from "../../constants/roles.js";
import { USER_STATUS } from "../../constants/userStatus.js";

export function getSettingByKey(key) {
  if (!key) {
    return null;
  }

  return prisma.systemSetting.findUnique({
    where: { key },
    select: {
      key: true,
      value: true,
    },
  });
}

export function findUpcomingAppointments(startAt, endAt) {
  return prisma.appointment.findMany({
    where: {
      deletedAt: null,
      status: {
        in: ["SCHEDULED", "CONFIRMED"],
      },
      startAt: {
        gte: startAt,
        lte: endAt,
      },
    },
    orderBy: {
      startAt: "asc",
    },
    select: {
      id: true,
      clientId: true,
      professionalId: true,
      serviceId: true,
      startAt: true,
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
        },
      },
      service: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

export function findAdmins() {
  return prisma.user.findMany({
    where: {
      role: ROLES.ADMIN,
      status: USER_STATUS.ACTIVE,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      role: true,
      status: true,
    },
  });
}

export function findExistingReminderNotification(userId, appointmentId) {
  if (!userId || !appointmentId) {
    return null;
  }

  return prisma.notification.findFirst({
    where: {
      userId,
      type: "APPOINTMENT_REMINDER",
      metadata: {
        path: ["appointmentId"],
        equals: appointmentId,
      },
    },
    select: {
      id: true,
    },
  });
}

export function createNotification(data) {
  return prisma.notification.create({
    data,
    select: {
      id: true,
      userId: true,
      title: true,
      message: true,
      type: true,
      readAt: true,
      metadata: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}
