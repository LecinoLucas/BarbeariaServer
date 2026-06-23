import prisma from "../../database/prisma.js";
import { ROLES } from "../../constants/roles.js";
import { USER_STATUS } from "../../constants/userStatus.js";

const notificationSelect = {
  id: true,
  userId: true,
  title: true,
  message: true,
  type: true,
  readAt: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
};

const userSelect = {
  id: true,
  status: true,
  deletedAt: true,
};

function buildListWhere(userId, filters) {
  const where = { userId };

  if (filters.read === true) {
    where.readAt = {
      not: null,
    };
  }

  if (filters.read === false) {
    where.readAt = null;
  }

  if (filters.type) {
    where.type = filters.type;
  }

  return where;
}

export function create(data) {
  return prisma.notification.create({
    data,
    select: notificationSelect,
  });
}

export function findById(id, userId) {
  if (!id || !userId) {
    return null;
  }

  return prisma.notification.findFirst({
    where: {
      id,
      userId,
    },
    select: notificationSelect,
  });
}

export function findUserById(id) {
  if (!id) {
    return null;
  }

  return prisma.user.findFirst({
    where: { id },
    select: userSelect,
  });
}

export function findActiveAdminUsers() {
  return prisma.user.findMany({
    where: {
      role: ROLES.ADMIN,
      status: USER_STATUS.ACTIVE,
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });
}

export function listByUserId(userId, filters) {
  return prisma.notification.findMany({
    where: buildListWhere(userId, filters),
    orderBy: {
      createdAt: "desc",
    },
    skip: (filters.page - 1) * filters.limit,
    take: filters.limit,
    select: notificationSelect,
  });
}

export function countByUserId(userId, filters) {
  return prisma.notification.count({
    where: buildListWhere(userId, filters),
  });
}

export function countUnreadByUserId(userId) {
  return prisma.notification.count({
    where: {
      userId,
      readAt: null,
    },
  });
}

export function markAsRead(id) {
  return prisma.notification.update({
    where: { id },
    data: {
      readAt: new Date(),
    },
    select: notificationSelect,
  });
}

export function markAllAsRead(userId) {
  return prisma.notification.updateMany({
    where: {
      userId,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });
}
