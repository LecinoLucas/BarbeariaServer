import prisma from "../../database/prisma.js";

const authUserWithClientSelect = {
  id: true,
  name: true,
  email: true,
  passwordHash: true,
  role: true,
  status: true,
  deletedAt: true,
  client: {
    select: {
      id: true,
      userId: true,
      name: true,
      phone: true,
      email: true,
      birthDate: true,
      status: true,
      deletedAt: true,
    },
  },
};

export const safeClientAuthUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  client: {
    select: {
      id: true,
      userId: true,
      name: true,
      phone: true,
      email: true,
      birthDate: true,
      status: true,
      deletedAt: true,
    },
  },
};

export function findClientAuthUserByEmail(email) {
  return prisma.user.findUnique({
    where: { email },
    select: authUserWithClientSelect,
  });
}

export function findClientAuthUserById(id) {
  if (!id) {
    return null;
  }

  return prisma.user.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    select: authUserWithClientSelect,
  });
}

export function updateClientAuthLastLoginAt(id) {
  return prisma.user.update({
    where: { id },
    data: {
      lastLoginAt: new Date(),
    },
  });
}

export function updateClientAuthPasswordHash(id, passwordHash) {
  return prisma.user.update({
    where: { id },
    data: {
      passwordHash,
    },
  });
}
