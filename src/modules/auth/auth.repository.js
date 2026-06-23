import prisma from "../../database/prisma.js";

const authUserSelect = {
  id: true,
  name: true,
  email: true,
  passwordHash: true,
  role: true,
  status: true,
  deletedAt: true,
};

const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
};

export function findUserByEmail(email) {
  return prisma.user.findUnique({
    where: { email },
    select: authUserSelect,
  });
}

export function findSafeUserById(id) {
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

export function updateLastLoginAt(id) {
  return prisma.user.update({
    where: { id },
    data: {
      lastLoginAt: new Date(),
    },
  });
}
