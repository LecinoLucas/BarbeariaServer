import prisma from "../../database/prisma.js";

const safeServiceSelect = {
  id: true,
  name: true,
  description: true,
  price: true,
  durationMinutes: true,
  status: true,
  createdAt: true,
  updatedAt: true,
};

function buildServiceWhere(filters) {
  const where = { deletedAt: null };

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  if (filters.status) {
    where.status = filters.status;
  }

  return where;
}

export function create(data) {
  return prisma.service.create({ data, select: safeServiceSelect });
}

export function findById(id) {
  if (!id) return null;
  return prisma.service.findFirst({
    where: { id, deletedAt: null },
    select: safeServiceSelect,
  });
}

export function findByName(name) {
  if (!name) return null;
  return prisma.service.findFirst({
    where: { name, deletedAt: null },
    select: safeServiceSelect,
  });
}

export function findByNameIgnoringId(name, id) {
  if (!name) return null;
  return prisma.service.findFirst({
    where: { name, deletedAt: null, id: { not: id } },
    select: safeServiceSelect,
  });
}

export function list(filters) {
  return prisma.service.findMany({
    where: buildServiceWhere(filters),
    orderBy: { createdAt: "desc" },
    skip: (filters.page - 1) * filters.limit,
    take: filters.limit,
    select: safeServiceSelect,
  });
}

export function count(filters) {
  return prisma.service.count({ where: buildServiceWhere(filters) });
}

export function update(id, data) {
  return prisma.service.update({ where: { id }, data, select: safeServiceSelect });
}

export function softDelete(id, deletedName) {
  return prisma.service.update({
    where: { id },
    data: { name: deletedName, deletedAt: new Date() },
    select: safeServiceSelect,
  });
}
