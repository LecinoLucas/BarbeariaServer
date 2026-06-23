import prisma from "../../database/prisma.js";

const professionalScheduleSelect = {
  id: true,
  professionalId: true,
  weekday: true,
  openTime: true,
  closeTime: true,
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

function buildWhere(filters = {}) {
  const where = {
    deletedAt: null,
  };

  if (filters.professionalId) where.professionalId = filters.professionalId;
  if (typeof filters.weekday === "number") where.weekday = filters.weekday;
  if (typeof filters.isActive === "boolean") where.isActive = filters.isActive;

  return where;
}

export function create(data) {
  return prisma.professionalSchedule.create({
    data,
    select: professionalScheduleSelect,
  });
}

export function findById(id) {
  if (!id) return null;

  return prisma.professionalSchedule.findFirst({
    where: { id, deletedAt: null },
    select: professionalScheduleSelect,
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

export function findActiveByProfessionalAndWeekday(professionalId, weekday) {
  return prisma.professionalSchedule.findFirst({
    where: {
      professionalId,
      weekday,
      isActive: true,
      deletedAt: null,
    },
    select: professionalScheduleSelect,
  });
}

export function findActiveByProfessionalAndWeekdayIgnoringId(
  professionalId,
  weekday,
  ignoringId,
) {
  return prisma.professionalSchedule.findFirst({
    where: {
      professionalId,
      weekday,
      isActive: true,
      deletedAt: null,
      id: { not: ignoringId },
    },
    select: { id: true },
  });
}

export function list(filters = {}) {
  return prisma.professionalSchedule.findMany({
    where: buildWhere(filters),
    orderBy: [{ weekday: "asc" }, { openTime: "asc" }],
    select: professionalScheduleSelect,
  });
}

export function update(id, data) {
  return prisma.professionalSchedule.update({
    where: { id },
    data,
    select: professionalScheduleSelect,
  });
}

export function updateStatus(id, isActive) {
  return prisma.professionalSchedule.update({
    where: { id },
    data: { isActive },
    select: professionalScheduleSelect,
  });
}

export function softDelete(id) {
  return prisma.professionalSchedule.update({
    where: { id },
    data: { deletedAt: new Date() },
    select: { id: true },
  });
}
