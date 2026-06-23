import prisma from "../../database/prisma.js";

const productSelect = {
  id: true,
  name: true,
  description: true,
  sku: true,
  barcode: true,
  priceCents: true,
  costCents: true,
  status: true,
  createdAt: true,
  updatedAt: true,
};

function buildWhere(filters) {
  const where = { deletedAt: null };
  if (filters.status) where.status = filters.status;
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { sku: { contains: filters.search, mode: "insensitive" } },
      { barcode: { contains: filters.search, mode: "insensitive" } },
    ];
  }
  return where;
}

export function create(data) {
  return prisma.product.create({ data, select: productSelect });
}

export function findById(id) {
  if (!id) return null;
  return prisma.product.findFirst({ where: { id, deletedAt: null }, select: productSelect });
}

export function findBySku(sku, excludingId) {
  if (!sku) return null;
  return prisma.product.findFirst({
    where: { sku, deletedAt: null, ...(excludingId ? { id: { not: excludingId } } : {}) },
    select: { id: true },
  });
}

export function list(filters) {
  return prisma.product.findMany({
    where: buildWhere(filters),
    orderBy: [{ name: "asc" }, { id: "asc" }],
    skip: (filters.page - 1) * filters.limit,
    take: filters.limit,
    select: productSelect,
  });
}

export function count(filters) {
  return prisma.product.count({ where: buildWhere(filters) });
}

export function update(id, data) {
  return prisma.product.update({ where: { id }, data, select: productSelect });
}

export { productSelect };
