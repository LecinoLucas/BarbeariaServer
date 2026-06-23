import prisma from "../../database/prisma.js";

const recurringBlockSelect = {
  id: true,
  professionalId: true,
  dayOfWeek: true,
  startTime: true,
  endTime: true,
  reason: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

function buildWhere(filters) {
  const where = {};

  if (filters.professionalId) where.professionalId = filters.professionalId;
  if (typeof filters.isActive === "boolean") where.isActive = filters.isActive;
  if (typeof filters.dayOfWeek === "number") where.dayOfWeek = filters.dayOfWeek;

  return where;
}

export function create(data) {
  return prisma.professionalRecurringBlock.create({
    data,
    select: recurringBlockSelect,
  });
}

export function findById(id) {
  if (!id) return null;
  return prisma.professionalRecurringBlock.findFirst({
    where: { id },
    select: recurringBlockSelect,
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

// Verifica se há bloqueio recorrente ativo que se sobrepõe no mesmo dia e horário.
// Dois intervalos [a,b) e [c,d) se sobrepõem quando: a < d && b > c.
// Para strings HH:mm, comparação lexicográfica é correta (zero-padded).
export function findOverlappingBlock(professionalId, dayOfWeek, startTime, endTime, ignoringId = null) {
  const where = {
    professionalId,
    dayOfWeek,
    isActive: true,
    AND: [
      { startTime: { lt: endTime } },
      { endTime: { gt: startTime } },
    ],
  };

  if (ignoringId) where.id = { not: ignoringId };

  return prisma.professionalRecurringBlock.findFirst({
    where,
    select: { id: true },
  });
}

export function list(filters) {
  return prisma.professionalRecurringBlock.findMany({
    where: buildWhere(filters),
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    select: recurringBlockSelect,
  });
}

export function update(id, data) {
  return prisma.professionalRecurringBlock.update({
    where: { id },
    data,
    select: recurringBlockSelect,
  });
}

export function remove(id) {
  return prisma.professionalRecurringBlock.delete({
    where: { id },
    select: { id: true },
  });
}

export function listActiveForProfessionalAndDay(professionalId, dayOfWeek) {
  return prisma.professionalRecurringBlock.findMany({
    where: { professionalId, dayOfWeek, isActive: true },
    select: { startTime: true, endTime: true },
  });
}
