import prisma from "../../database/prisma.js";

const CONFLICT_STATUSES = ["SCHEDULED", "CONFIRMED", "IN_ATTENDANCE"];

const scheduleBlockSelect = {
  id: true,
  professionalId: true,
  title: true,
  reason: true,
  startAt: true,
  endAt: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  professional: {
    select: {
      id: true,
      userId: true,
      name: true,
      status: true,
    },
  },
};

function buildWhere(filters) {
  const where = {
    deletedAt: null,
  };

  if (filters.professionalId) where.professionalId = filters.professionalId;
  if (typeof filters.isActive === "boolean") where.isActive = filters.isActive;

  if (filters.startDate || filters.endDate) {
    where.AND = [];

    if (filters.startDate) {
      where.AND.push({
        endAt: {
          gt: new Date(`${filters.startDate}T00:00:00.000Z`),
        },
      });
    }

    if (filters.endDate) {
      where.AND.push({
        startAt: {
          lt: new Date(`${filters.endDate}T23:59:59.999Z`),
        },
      });
    }
  }

  return where;
}

export function create(data) {
  return prisma.scheduleBlock.create({
    data,
    select: scheduleBlockSelect,
  });
}

export function findById(id) {
  if (!id) return null;

  return prisma.scheduleBlock.findFirst({
    where: { id, deletedAt: null },
    select: scheduleBlockSelect,
  });
}

export function findProfessionalById(id) {
  if (!id) return null;

  return prisma.professional.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, userId: true, name: true, status: true },
  });
}

export function findProfessionalByUserId(userId) {
  if (!userId) return null;

  return prisma.professional.findFirst({
    where: { userId, deletedAt: null },
    select: { id: true, userId: true, name: true, status: true },
  });
}

export function findConflictingBlock(professionalId, startAt, endAt, ignoringId = null) {
  const where = {
    professionalId,
    deletedAt: null,
    isActive: true,
    startAt: { lt: endAt },
    endAt: { gt: startAt },
  };

  if (ignoringId) {
    where.id = { not: ignoringId };
  }

  return prisma.scheduleBlock.findFirst({
    where,
    select: { id: true },
  });
}

export function findConflictingAppointment(professionalId, startAt, endAt, ignoringId = null) {
  const where = {
    professionalId,
    deletedAt: null,
    status: { in: CONFLICT_STATUSES },
    startAt: { lt: endAt },
    endAt: { gt: startAt },
  };

  if (ignoringId) {
    where.id = { not: ignoringId };
  }

  return prisma.appointment.findFirst({
    where,
    select: { id: true },
  });
}

export function list(filters) {
  return prisma.scheduleBlock.findMany({
    where: buildWhere(filters),
    orderBy: { startAt: "asc" },
    skip: (filters.page - 1) * filters.limit,
    take: filters.limit,
    select: scheduleBlockSelect,
  });
}

export function count(filters) {
  return prisma.scheduleBlock.count({
    where: buildWhere(filters),
  });
}

export function update(id, data) {
  return prisma.scheduleBlock.update({
    where: { id },
    data,
    select: scheduleBlockSelect,
  });
}

export function updateStatus(id, isActive) {
  return prisma.scheduleBlock.update({
    where: { id },
    data: { isActive },
    select: scheduleBlockSelect,
  });
}

export function softDelete(id) {
  return prisma.scheduleBlock.update({
    where: { id },
    data: { deletedAt: new Date() },
    select: { id: true },
  });
}

export function listBlocksByDateAndProfessional(professionalId, date) {
  return prisma.scheduleBlock.findMany({
    where: {
      professionalId,
      deletedAt: null,
      isActive: true,
      startAt: {
        lt: new Date(`${date}T23:59:59.999Z`),
      },
      endAt: {
        gt: new Date(`${date}T00:00:00.000Z`),
      },
    },
    orderBy: { startAt: "asc" },
    select: { startAt: true, endAt: true },
  });
}
