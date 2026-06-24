import prisma from "../../database/prisma.js";

const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
};

function buildListWhere(filters) {
  const where = {
    deletedAt: null,
  };

  if (filters.search) {
    where.OR = [
      {
        name: {
          contains: filters.search,
          mode: "insensitive",
        },
      },
      {
        email: {
          contains: filters.search,
          mode: "insensitive",
        },
      },
    ];
  }

  if (filters.role) {
    where.role = filters.role;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  return where;
}

export function create(data) {
  return prisma.user.create({
    data,
    select: safeUserSelect,
  });
}

export function findById(id) {
  if (!id) {
    return null;
  }

  return prisma.user.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    select: safeUserSelect,
  });
}

export function findByEmail(email) {
  return prisma.user.findFirst({
    where: {
      email,
      deletedAt: null,
    },
    select: safeUserSelect,
  });
}

export function findByEmailIgnoringId(email, id) {
  return prisma.user.findFirst({
    where: {
      email,
      deletedAt: null,
      id: {
        not: id,
      },
    },
    select: safeUserSelect,
  });
}

export function listByIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return [];
  }

  return prisma.user.findMany({
    where: {
      id: {
        in: ids,
      },
      deletedAt: null,
    },
    select: safeUserSelect,
  });
}

export function list(filters) {
  return prisma.user.findMany({
    where: buildListWhere(filters),
    orderBy: {
      createdAt: "desc",
    },
    skip: (filters.page - 1) * filters.limit,
    take: filters.limit,
    select: safeUserSelect,
  });
}

export function count(filters) {
  return prisma.user.count({
    where: buildListWhere(filters),
  });
}

export function update(id, data) {
  return prisma.user.update({
    where: { id },
    data,
    select: safeUserSelect,
  });
}

export function softDelete(id, deletedEmail) {
  return prisma.user.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      email: deletedEmail,
    },
    select: safeUserSelect,
  });
}

export function countActiveAdmins() {
  return prisma.user.count({
    where: {
      deletedAt: null,
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
}
