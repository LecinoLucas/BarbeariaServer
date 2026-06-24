import prisma from "../../database/prisma.js";
import { getBusinessDayUtcRange } from "../../utils/agendaTimezone.js";

const CONFLICT_STATUSES = ["SCHEDULED", "CONFIRMED", "IN_ATTENDANCE"];

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
  client: {
    select: { id: true, name: true, phone: true },
  },
  professional: {
    select: { id: true, name: true, phone: true, specialty: true },
  },
  service: {
    select: { id: true, name: true, price: true, durationMinutes: true },
  },
};

const appointmentDaySelect = {
  id: true,
  clientId: true,
  professionalId: true,
  serviceId: true,
  startAt: true,
  endAt: true,
  status: true,
  notes: true,
  client: {
    select: { id: true, name: true, phone: true },
  },
  professional: {
    select: { id: true, name: true, phone: true, specialty: true },
  },
  service: {
    select: { id: true, name: true, price: true, durationMinutes: true },
  },
};

const appointmentWeekSelect = {
  id: true,
  startAt: true,
  status: true,
  client: {
    select: { id: true, name: true },
  },
  professional: {
    select: { id: true, name: true },
  },
  service: {
    select: { id: true, name: true, price: true },
  },
};

const appointmentRescheduleSelect = {
  id: true,
  clientId: true,
  professionalId: true,
  serviceId: true,
  startAt: true,
  endAt: true,
  status: true,
  service: {
    select: {
      id: true,
      durationMinutes: true,
    },
  },
};

const upcomingAlertSelect = {
  id: true,
  startAt: true,
  status: true,
  client: {
    select: { id: true, name: true },
  },
  professional: {
    select: { id: true, name: true },
  },
  service: {
    select: { id: true, name: true },
  },
};

const duplicateAppointmentSelect = {
  id: true,
  clientId: true,
  professionalId: true,
  serviceId: true,
  startAt: true,
  endAt: true,
  status: true,
  client: { select: { id: true, name: true } },
  professional: { select: { id: true, name: true } },
  service: { select: { id: true, name: true } },
};

function getDb(prismaOrTx) {
  return prismaOrTx ?? prisma;
}

function buildWhere(filters) {
  const where = { deletedAt: null };

  if (filters.status) where.status = filters.status;
  if (filters.clientId) where.clientId = filters.clientId;
  if (filters.professionalId) where.professionalId = filters.professionalId;
  if (filters.serviceId) where.serviceId = filters.serviceId;

  if (filters.date) {
    const { startUtc, endUtc } = getBusinessDayUtcRange(filters.date);
    where.startAt = {
      gte: startUtc,
      lte: endUtc,
    };
  } else if (filters.startDate || filters.endDate) {
    where.startAt = {};
    if (filters.startDate) {
      where.startAt.gte = getBusinessDayUtcRange(filters.startDate).startUtc;
    }
    if (filters.endDate) {
      where.startAt.lte = getBusinessDayUtcRange(filters.endDate).endUtc;
    }
  }

  if (filters.search) {
    const s = filters.search;
    where.OR = [
      { client: { name: { contains: s, mode: "insensitive" } } },
      { client: { phone: { contains: s } } },
      { professional: { name: { contains: s, mode: "insensitive" } } },
      { service: { name: { contains: s, mode: "insensitive" } } },
    ];
  }

  return where;
}

export function create(data) {
  return prisma.appointment.create({ data, select: appointmentSelect });
}

export function findById(id) {
  if (!id) return null;
  return prisma.appointment.findFirst({
    where: { id, deletedAt: null },
    select: appointmentSelect,
  });
}

export function list(filters) {
  return prisma.appointment.findMany({
    where: buildWhere(filters),
    orderBy: { startAt: "asc" },
    skip: (filters.page - 1) * filters.limit,
    take: filters.limit,
    select: appointmentSelect,
  });
}

export function listByDay(filters) {
  return prisma.appointment.findMany({
    where: buildWhere(filters),
    orderBy: { startAt: "asc" },
    select: appointmentDaySelect,
  });
}

export function listByWeek(filters) {
  return prisma.appointment.findMany({
    where: buildWhere(filters),
    orderBy: [{ startAt: "asc" }],
    select: appointmentWeekSelect,
  });
}

export function listMonthSummaryRows(filters) {
  return prisma.appointment.findMany({
    where: buildWhere(filters),
    orderBy: { startAt: "asc" },
    select: {
      id: true,
      startAt: true,
      status: true,
      client: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

export function listUpcomingAlerts(
  {
    endAtLte,
    limit = 10,
    professionalId,
    startAtGte,
    statuses,
  },
  prismaOrTx = prisma,
) {
  const where = {
    deletedAt: null,
    startAt: {
      gte: startAtGte,
      lte: endAtLte,
    },
    status: { in: statuses },
  };

  if (professionalId) {
    where.professionalId = professionalId;
  }

  return getDb(prismaOrTx).appointment.findMany({
    where,
    orderBy: { startAt: "asc" },
    take: limit,
    select: upcomingAlertSelect,
  });
}

export function count(filters) {
  return prisma.appointment.count({ where: buildWhere(filters) });
}

export function update(id, data) {
  return prisma.appointment.update({ where: { id }, data, select: appointmentSelect });
}

export function updateStatus(id, status) {
  return prisma.appointment.update({
    where: { id },
    data: { status },
    select: appointmentSelect,
  });
}

export function softDelete(id) {
  return prisma.appointment.update({
    where: { id },
    data: { deletedAt: new Date() },
    select: { id: true },
  });
}

export function findClientById(id) {
  if (!id) return null;
  return prisma.client.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, userId: true, name: true, status: true },
  });
}

export function findClientByUserId(userId, prismaOrTx = prisma) {
  if (!userId) return null;
  return getDb(prismaOrTx).client.findFirst({
    where: { userId, deletedAt: null },
    select: { id: true, userId: true, name: true, status: true },
  });
}

export function findProfessionalById(id, prismaOrTx = prisma) {
  if (!id) return null;
  return getDb(prismaOrTx).professional.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, userId: true, name: true, status: true, appointmentIntervalMinutes: true },
  });
}

export function findProfessionalByUserId(userId, prismaOrTx = prisma) {
  if (!userId) return null;
  return getDb(prismaOrTx).professional.findFirst({
    where: { userId, deletedAt: null },
    select: { id: true, userId: true, name: true, status: true },
  });
}

export function findServiceById(id, prismaOrTx = prisma) {
  if (!id) return null;
  return getDb(prismaOrTx).service.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, name: true, price: true, durationMinutes: true, status: true },
  });
}

export function findConflictingAppointment(
  professionalId,
  startAt,
  endAt,
  ignoringId = null,
  prismaOrTx = prisma,
) {
  const where = {
    professionalId,
    deletedAt: null,
    status: { in: CONFLICT_STATUSES },
    startAt: { lt: endAt },
    endAt: { gt: startAt },
  };

  if (ignoringId) where.id = { not: ignoringId };

  return getDb(prismaOrTx).appointment.findFirst({
    where,
    select: { id: true, startAt: true, endAt: true, status: true },
  });
}

export function findActiveClientServiceAppointment(clientId, serviceId) {
  return prisma.appointment.findFirst({
    where: {
      clientId,
      serviceId,
      deletedAt: null,
      status: { in: CONFLICT_STATUSES },
      OR: [
        { startAt: { gte: new Date() } },
        { status: "IN_ATTENDANCE" },
      ],
    },
    orderBy: { startAt: "asc" },
    select: duplicateAppointmentSelect,
  });
}

export function findConflictingScheduleBlock(
  professionalId,
  startAt,
  endAt,
  ignoringId = null,
  prismaOrTx = prisma,
) {
  const where = {
    professionalId,
    deletedAt: null,
    isActive: true,
    startAt: { lt: endAt },
    endAt: { gt: startAt },
  };

  if (ignoringId) where.id = { not: ignoringId };

  return getDb(prismaOrTx).scheduleBlock.findFirst({
    where,
    select: { id: true, startAt: true, endAt: true },
  });
}

export function listAppointmentsByDateAndProfessional(professionalId, date) {
  const { startUtc, endUtc } = getBusinessDayUtcRange(date);

  return prisma.appointment.findMany({
    where: {
      professionalId,
      deletedAt: null,
      status: { in: CONFLICT_STATUSES },
      startAt: {
        gte: startUtc,
        lte: endUtc,
      },
    },
    select: { startAt: true, endAt: true },
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

export function getSystemSettings(keys, prismaOrTx = prisma) {
  return getDb(prismaOrTx).systemSetting.findMany({
    where: { key: { in: keys } },
    select: { key: true, value: true },
  });
}

export function listScheduleBlocksByDateAndProfessional(professionalId, date) {
  const { startUtc, endUtc } = getBusinessDayUtcRange(date);

  return prisma.scheduleBlock.findMany({
    where: {
      professionalId,
      deletedAt: null,
      isActive: true,
      startAt: { lt: endUtc },
      endAt: { gt: startUtc },
    },
    select: { startAt: true, endAt: true },
  });
}

export function listActiveRecurringBlocksForDay(professionalId, dayOfWeek) {
  return prisma.professionalRecurringBlock.findMany({
    where: { professionalId, dayOfWeek, isActive: true },
    select: { startTime: true, endTime: true },
  });
}

export function findAppointmentForReschedule(id, prismaOrTx = prisma) {
  if (!id) return null;

  return getDb(prismaOrTx).appointment.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    select: appointmentRescheduleSelect,
  });
}

export function findProfessionalAvailabilityContext(
  professionalId,
  weekday,
  prismaOrTx = prisma,
) {
  if (!professionalId) return null;

  return getDb(prismaOrTx).professional.findFirst({
    where: {
      id: professionalId,
      deletedAt: null,
    },
    select: {
      id: true,
      status: true,
      appointmentIntervalMinutes: true,
      schedules: {
        where: {
          weekday,
          isActive: true,
          deletedAt: null,
        },
        select: {
          id: true,
          openTime: true,
          closeTime: true,
        },
        take: 1,
      },
      recurringBlocks: {
        where: {
          dayOfWeek: weekday,
          isActive: true,
        },
        select: {
          startTime: true,
          endTime: true,
        },
      },
    },
  });
}

export function updateAppointmentSchedule(id, data, prismaOrTx = prisma) {
  return getDb(prismaOrTx).appointment.update({
    where: { id },
    data,
    select: appointmentSelect,
  });
}
