import prisma from "../../database/prisma.js";

const safeProfessionalSelect = {
  id: true,
  userId: true,
  name: true,
  phone: true,
  specialty: true,
  appointmentIntervalMinutes: true,
  status: true,
  createdAt: true,
  updatedAt: true,
};

function buildProfessionalWhere(filters) {
  const where = { deletedAt: null };

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { phone: { contains: filters.search, mode: "insensitive" } },
      { specialty: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  if (filters.status) {
    where.status = filters.status;
  }

  return where;
}

export function create(data) {
  return prisma.professional.create({
    data,
    select: safeProfessionalSelect,
  });
}

export function findById(id) {
  if (!id) return null;

  return prisma.professional.findFirst({
    where: { id, deletedAt: null },
    select: safeProfessionalSelect,
  });
}

export function findByUserId(userId) {
  if (!userId) return null;

  return prisma.professional.findFirst({
    where: { userId, deletedAt: null },
    select: safeProfessionalSelect,
  });
}

export function findByPhone(phone) {
  if (!phone) return null;

  return prisma.professional.findFirst({
    where: { phone, deletedAt: null },
    select: safeProfessionalSelect,
  });
}

export function findByPhoneIgnoringId(phone, id) {
  if (!phone) return null;

  return prisma.professional.findFirst({
    where: { phone, deletedAt: null, id: { not: id } },
    select: safeProfessionalSelect,
  });
}

export function findUserById(id) {
  if (!id) return null;

  return prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, name: true, email: true, role: true, status: true },
  });
}

export function findLinkedProfessionalByUserId(userId) {
  if (!userId) return null;

  return prisma.professional.findFirst({
    where: { userId, deletedAt: null },
    select: safeProfessionalSelect,
  });
}

export function findLinkedProfessionalByUserIdIgnoringId(userId, id) {
  if (!userId) return null;

  return prisma.professional.findFirst({
    where: { userId, deletedAt: null, id: { not: id } },
    select: safeProfessionalSelect,
  });
}

export function list(filters) {
  return prisma.professional.findMany({
    where: buildProfessionalWhere(filters),
    orderBy: { createdAt: "desc" },
    skip: (filters.page - 1) * filters.limit,
    take: filters.limit,
    select: safeProfessionalSelect,
  });
}

export function count(filters) {
  return prisma.professional.count({
    where: buildProfessionalWhere(filters),
  });
}

export function update(id, data) {
  return prisma.professional.update({
    where: { id },
    data,
    select: safeProfessionalSelect,
  });
}

export function softDelete(id, deletedPhone) {
  return prisma.professional.update({
    where: { id },
    data: {
      phone: deletedPhone,
      deletedAt: new Date(),
    },
    select: safeProfessionalSelect,
  });
}
