import prisma from "../../database/prisma.js";

const paymentMethodSelect = {
  id: true,
  code: true,
  name: true,
  description: true,
  isActive: true,
  displayOrder: true,
  createdAt: true,
  updatedAt: true,
};

function buildWhere(filters) {
  const where = {};

  if (filters.isActive !== undefined) {
    where.isActive = filters.isActive;
  }

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { code: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return where;
}

export function findById(id) {
  if (!id) return null;
  return prisma.paymentMethodConfig.findFirst({
    where: { id },
    select: paymentMethodSelect,
  });
}

export function findByCode(code) {
  if (!code) return null;
  return prisma.paymentMethodConfig.findFirst({
    where: { code },
    select: paymentMethodSelect,
  });
}

export function findByCodeIgnoringId(code, id) {
  if (!code) return null;
  return prisma.paymentMethodConfig.findFirst({
    where: { code, id: { not: id } },
    select: { id: true },
  });
}

export function countPaymentsUsingMethod(id) {
  return prisma.payment.count({ where: { paymentMethodId: id } });
}

export function list(filters) {
  return prisma.paymentMethodConfig.findMany({
    where: buildWhere(filters),
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    skip: (filters.page - 1) * filters.limit,
    take: filters.limit,
    select: paymentMethodSelect,
  });
}

export function count(filters) {
  return prisma.paymentMethodConfig.count({ where: buildWhere(filters) });
}

export function create(data) {
  return prisma.paymentMethodConfig.create({ data, select: paymentMethodSelect });
}

export function update(id, data) {
  return prisma.paymentMethodConfig.update({ where: { id }, data, select: paymentMethodSelect });
}

export function deactivate(id) {
  return prisma.paymentMethodConfig.update({
    where: { id },
    data: { isActive: false },
    select: paymentMethodSelect,
  });
}
