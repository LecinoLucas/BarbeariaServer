import prisma from "../../database/prisma.js";

const authUserWithClientSelect = {
  id: true,
  name: true,
  email: true,
  passwordHash: true,
  googleId: true,
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

const signupClientSelect = {
  id: true,
  userId: true,
  name: true,
  phone: true,
  email: true,
  birthDate: true,
  status: true,
  deletedAt: true,
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

export function findClientAuthUserByGoogleId(googleId) {
  if (!googleId) {
    return null;
  }

  return prisma.user.findFirst({
    where: {
      googleId,
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

export function updateClientAuthGoogleId(id, googleId) {
  return prisma.user.update({
    where: { id },
    data: {
      googleId,
    },
    select: authUserWithClientSelect,
  });
}

export function findClientAuthSignupCandidateByEmail(email) {
  if (!email) {
    return null;
  }

  return prisma.client.findFirst({
    where: {
      email,
      deletedAt: null,
    },
    select: signupClientSelect,
  });
}

export function findClientAuthSignupCandidateByPhone(phone) {
  if (!phone) {
    return null;
  }

  return prisma.client.findFirst({
    where: {
      phone,
      deletedAt: null,
    },
    select: signupClientSelect,
  });
}

export function createClientAuthSignup({ clientData, existingClientId = null, userData }) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: userData,
      select: safeClientAuthUserSelect,
    });

    const client = existingClientId
      ? await tx.client.update({
          where: { id: existingClientId },
          data: {
            userId: user.id,
            name: clientData.name,
            phone: clientData.phone,
            email: clientData.email,
            status: clientData.status,
          },
          select: signupClientSelect,
        })
      : await tx.client.create({
          data: {
            userId: user.id,
            name: clientData.name,
            phone: clientData.phone,
            email: clientData.email,
            status: clientData.status,
          },
          select: signupClientSelect,
        });

    return { user, client };
  });
}
