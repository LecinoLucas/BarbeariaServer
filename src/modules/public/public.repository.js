import prisma from "../../database/prisma.js";

const publicServiceSelect = {
  id: true,
  name: true,
  description: true,
  durationMinutes: true,
  price: true,
  status: true,
};

const publicProductSelect = {
  id: true,
  name: true,
  description: true,
  sku: true,
  priceCents: true,
  status: true,
};

export function listPublicServices({ limit, offset }) {
  return prisma.service.findMany({
    where: { deletedAt: null, status: "ACTIVE" },
    orderBy: { name: "asc" },
    take: limit,
    skip: offset,
    select: publicServiceSelect,
  });
}

export function countPublicServices() {
  return prisma.service.count({
    where: { deletedAt: null, status: "ACTIVE" },
  });
}

export function listPublicProducts({ limit, offset }) {
  return prisma.product.findMany({
    where: { deletedAt: null, status: "ACTIVE" },
    orderBy: { name: "asc" },
    take: limit,
    skip: offset,
    select: publicProductSelect,
  });
}

export function countPublicProducts() {
  return prisma.product.count({
    where: { deletedAt: null, status: "ACTIVE" },
  });
}
