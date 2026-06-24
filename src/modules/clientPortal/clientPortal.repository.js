import { Prisma } from "@prisma/client";

import { ROLES } from "../../constants/roles.js";
import { USER_STATUS } from "../../constants/userStatus.js";
import prisma from "../../database/prisma.js";

const safeClientSelect = {
  id: true,
  userId: true,
  name: true,
  phone: true,
  email: true,
  birthDate: true,
  notes: true,
  status: true,
  createdAt: true,
  updatedAt: true,
};

const appointmentSelect = {
  id: true,
  clientId: true,
  professionalId: true,
  serviceId: true,
  startAt: true,
  endAt: true,
  status: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  professional: {
    select: {
      id: true,
      name: true,
      specialty: true,
    },
  },
  service: {
    select: {
      id: true,
      name: true,
      price: true,
      durationMinutes: true,
    },
  },
  client: {
    select: {
      id: true,
      name: true,
    },
  },
};

const attendanceSelect = {
  id: true,
  appointmentId: true,
  clientId: true,
  professionalId: true,
  startedAt: true,
  finishedAt: true,
  status: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  professional: {
    select: {
      id: true,
      name: true,
      specialty: true,
    },
  },
  appointment: {
    select: {
      id: true,
      startAt: true,
      endAt: true,
      status: true,
      service: {
        select: {
          id: true,
          name: true,
          price: true,
          durationMinutes: true,
        },
      },
    },
  },
  items: {
    select: {
      id: true,
      serviceId: true,
      description: true,
      quantity: true,
      unitPrice: true,
      total: true,
      service: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
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

const clientPortalServiceSelect = {
  id: true,
  name: true,
  description: true,
  durationMinutes: true,
  price: true,
};

const clientPortalProfessionalSelect = {
  id: true,
  name: true,
  specialty: true,
};

const clientPortalAppointmentSelect = {
  id: true,
  clientId: true,
  professionalId: true,
  serviceId: true,
  startAt: true,
  endAt: true,
  status: true,
  notes: true,
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
  client: {
    select: {
      id: true,
      name: true,
    },
  },
};

function buildAppointmentsWhere(clientId, filters) {
  const where = {
    clientId,
    deletedAt: null,
    professional: {
      deletedAt: null,
    },
    service: {
      deletedAt: null,
    },
  };

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.startDate || filters.endDate) {
    where.startAt = {};

    if (filters.startDate) {
      where.startAt.gte = new Date(`${filters.startDate}T00:00:00.000Z`);
    }

    if (filters.endDate) {
      where.startAt.lte = new Date(`${filters.endDate}T23:59:59.999Z`);
    }
  }

  return where;
}

function buildAttendancesWhere(clientId, filters) {
  const where = {
    clientId,
  };

  if (filters.startDate || filters.endDate) {
    where.startedAt = {};

    if (filters.startDate) {
      where.startedAt.gte = new Date(`${filters.startDate}T00:00:00.000Z`);
    }

    if (filters.endDate) {
      where.startedAt.lte = new Date(`${filters.endDate}T23:59:59.999Z`);
    }
  }

  return where;
}

export function findClientByUserId(userId) {
  if (!userId) {
    return null;
  }

  return prisma.client.findFirst({
    where: {
      userId,
      deletedAt: null,
    },
    select: safeClientSelect,
  });
}

export function findByPhoneIgnoringId(phone, id) {
  if (!phone) {
    return null;
  }

  return prisma.client.findFirst({
    where: {
      phone,
      deletedAt: null,
      id: {
        not: id,
      },
    },
    select: { id: true },
  });
}

export function findByEmailIgnoringId(email, id) {
  if (!email) {
    return null;
  }

  return prisma.client.findFirst({
    where: {
      email,
      deletedAt: null,
      id: {
        not: id,
      },
    },
    select: { id: true },
  });
}

export function getNextAppointment(clientId, now) {
  return prisma.appointment.findFirst({
    where: {
      clientId,
      deletedAt: null,
      professional: {
        deletedAt: null,
      },
      service: {
        deletedAt: null,
      },
      status: {
        in: ["SCHEDULED", "CONFIRMED"],
      },
      startAt: {
        gt: now,
      },
    },
    orderBy: {
      startAt: "asc",
    },
    select: appointmentSelect,
  });
}

export function getLastAttendance(clientId) {
  return prisma.attendance.findFirst({
    where: {
      clientId,
      status: "FINISHED",
    },
    orderBy: {
      finishedAt: "desc",
    },
    select: attendanceSelect,
  });
}

export function countFinishedAttendancesByPeriod(clientId, start, end) {
  return prisma.attendance.count({
    where: {
      clientId,
      status: "FINISHED",
      finishedAt: {
        gte: start,
        lt: end,
      },
    },
  });
}

export async function sumPaidPaymentsByPeriod(clientId, start, end) {
  const result = await prisma.payment.aggregate({
    _sum: {
      total: true,
    },
    where: {
      status: "PAID",
      paidAt: {
        gte: start,
        lt: end,
      },
      attendance: {
        clientId,
      },
    },
  });

  return Number(result._sum.total ?? 0);
}

export async function getFavoriteProfessional(clientId) {
  const [result] = await prisma.$queryRaw(
    Prisma.sql`
      SELECT
        p."id" AS "professionalId",
        p."name",
        COUNT(a."id")::int AS "attendances"
      FROM "attendances" a
      INNER JOIN "professionals" p
        ON p."id" = a."professionalId"
      WHERE
        a."clientId" = ${clientId}
        AND a."status" = 'FINISHED'::"AttendanceStatus"
        AND p."deletedAt" IS NULL
      GROUP BY p."id", p."name"
      ORDER BY "attendances" DESC, p."name" ASC
      LIMIT 1
    `,
  );

  return result ?? null;
}

export async function getFavoriteService(clientId) {
  const [result] = await prisma.$queryRaw(
    Prisma.sql`
      SELECT
        s."id" AS "serviceId",
        s."name",
        COALESCE(SUM(ai."quantity"), 0)::int AS "quantity"
      FROM "attendance_items" ai
      INNER JOIN "attendances" a
        ON a."id" = ai."attendanceId"
      INNER JOIN "services" s
        ON s."id" = ai."serviceId"
      WHERE
        a."clientId" = ${clientId}
        AND a."status" = 'FINISHED'::"AttendanceStatus"
        AND s."deletedAt" IS NULL
      GROUP BY s."id", s."name"
      ORDER BY "quantity" DESC, s."name" ASC
      LIMIT 1
    `,
  );

  return result ?? null;
}

export function listAppointments(clientId, filters) {
  return prisma.appointment.findMany({
    where: buildAppointmentsWhere(clientId, filters),
    orderBy: {
      startAt: "desc",
    },
    skip: (filters.page - 1) * filters.limit,
    take: filters.limit,
    select: appointmentSelect,
  });
}

export function countAppointments(clientId, filters) {
  return prisma.appointment.count({
    where: buildAppointmentsWhere(clientId, filters),
  });
}

export function listUpcomingClientAppointments(clientId, now, limit = 100) {
  return prisma.appointment.findMany({
    where: {
      clientId,
      deletedAt: null,
      professional: {
        deletedAt: null,
      },
      service: {
        deletedAt: null,
      },
      OR: [
        {
          status: "IN_ATTENDANCE",
        },
        {
          status: {
            in: ["SCHEDULED", "CONFIRMED"],
          },
          startAt: {
            gte: now,
          },
        },
      ],
    },
    orderBy: {
      startAt: "asc",
    },
    take: limit,
    select: appointmentSelect,
  });
}

export function listHistoricalClientAppointments(clientId, now, limit = 20) {
  return prisma.appointment.findMany({
    where: {
      clientId,
      deletedAt: null,
      professional: {
        deletedAt: null,
      },
      service: {
        deletedAt: null,
      },
      OR: [
        {
          status: {
            in: ["CANCELED", "FINISHED", "NO_SHOW"],
          },
        },
        {
          status: {
            in: ["SCHEDULED", "CONFIRMED"],
          },
          startAt: {
            lt: now,
          },
        },
      ],
    },
    orderBy: {
      startAt: "desc",
    },
    take: limit,
    select: appointmentSelect,
  });
}

export function listAttendances(clientId, filters) {
  return prisma.attendance.findMany({
    where: buildAttendancesWhere(clientId, filters),
    orderBy: {
      startedAt: "desc",
    },
    skip: (filters.page - 1) * filters.limit,
    take: filters.limit,
    select: attendanceSelect,
  });
}

export function countAttendances(clientId, filters) {
  return prisma.attendance.count({
    where: buildAttendancesWhere(clientId, filters),
  });
}

export function countAllAppointments(clientId) {
  return prisma.appointment.count({
    where: {
      clientId,
      deletedAt: null,
      professional: {
        deletedAt: null,
      },
      service: {
        deletedAt: null,
      },
    },
  });
}

export function countActiveClientAppointments(clientId) {
  return prisma.appointment.count({
    where: {
      clientId,
      deletedAt: null,
      status: {
        in: ["SCHEDULED", "CONFIRMED"],
      },
      professional: {
        deletedAt: null,
      },
      service: {
        deletedAt: null,
      },
    },
  });
}

export function countAllFinishedAttendances(clientId) {
  return prisma.attendance.count({
    where: {
      clientId,
      status: "FINISHED",
    },
  });
}

export function listRecentAttendances(clientId, limit) {
  return prisma.attendance.findMany({
    where: {
      clientId,
      status: "FINISHED",
    },
    orderBy: {
      finishedAt: "desc",
    },
    take: limit,
    select: attendanceSelect,
  });
}

export function listActiveClientPortalServices() {
  return prisma.service.findMany({
    where: {
      deletedAt: null,
      status: "ACTIVE",
    },
    orderBy: {
      name: "asc",
    },
    select: clientPortalServiceSelect,
  });
}

export function listActiveClientPortalProfessionals() {
  return prisma.professional.findMany({
    where: {
      deletedAt: null,
      status: USER_STATUS.ACTIVE,
    },
    orderBy: {
      name: "asc",
    },
    select: clientPortalProfessionalSelect,
  });
}

export function createClientPortalAppointment(data) {
  return prisma.appointment.create({
    data,
    select: clientPortalAppointmentSelect,
  });
}

export function updateClientProfile(id, data) {
  return prisma.client.update({
    where: {
      id,
    },
    data,
    select: safeClientSelect,
  });
}

export function findAppointmentById(id) {
  if (!id) {
    return null;
  }

  return prisma.appointment.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    select: appointmentSelect,
  });
}

export function updateAppointmentStatus(id, status) {
  return prisma.appointment.update({
    where: { id },
    data: { status },
    select: appointmentSelect,
  });
}

export function updateAppointmentDate(id, startAt, endAt) {
  return prisma.appointment.update({
    where: { id },
    data: {
      startAt,
      endAt,
    },
    select: appointmentSelect,
  });
}

export function findServiceById(id) {
  if (!id) {
    return null;
  }

  return prisma.service.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      durationMinutes: true,
      status: true,
    },
  });
}

export function findConflictingAppointment(professionalId, startAt, endAt, ignoringId = null) {
  const where = {
    professionalId,
    deletedAt: null,
    status: {
      in: ["SCHEDULED", "CONFIRMED", "IN_ATTENDANCE"],
    },
    startAt: {
      lt: endAt,
    },
    endAt: {
      gt: startAt,
    },
  };

  if (ignoringId) {
    where.id = {
      not: ignoringId,
    };
  }

  return prisma.appointment.findFirst({
    where,
    select: { id: true },
  });
}

export function findConflictingScheduleBlock(professionalId, startAt, endAt) {
  return prisma.scheduleBlock.findFirst({
    where: {
      professionalId,
      deletedAt: null,
      isActive: true,
      startAt: {
        lt: endAt,
      },
      endAt: {
        gt: startAt,
      },
    },
    select: { id: true },
  });
}

export function findActiveProfessionalScheduleByWeekday(professionalId, weekday) {
  return prisma.professionalSchedule.findFirst({
    where: {
      professionalId,
      weekday,
      isActive: true,
      deletedAt: null,
    },
    select: {
      id: true,
      openTime: true,
      closeTime: true,
    },
  });
}

export function getSettingByKey(key) {
  return prisma.systemSetting.findUnique({
    where: { key },
    select: {
      key: true,
      value: true,
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
    },
  });
}

export function createNotification(data) {
  return prisma.notification.create({
    data,
    select: notificationSelect,
  });
}
