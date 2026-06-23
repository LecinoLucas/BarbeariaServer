import { USER_STATUS } from "../../constants/userStatus.js";
import { BadRequestError } from "../../errors/BadRequestError.js";
import { ConflictError } from "../../errors/ConflictError.js";
import { ForbiddenError } from "../../errors/ForbiddenError.js";
import { NotFoundError } from "../../errors/NotFoundError.js";
import { UnauthorizedError } from "../../errors/UnauthorizedError.js";
import {
  emitNotificationToAdmins,
  emitNotificationToUser,
} from "../../socket/socket.emitter.js";
import {
  countByUserId,
  countUnreadByUserId,
  create,
  findActiveAdminUsers,
  findById,
  findUserById,
  listByUserId,
  markAllAsRead,
  markAsRead,
} from "./notification.repository.js";

const NOT_FOUND_MESSAGE = "Notificação não encontrada.";


async function ensureActiveDestinationUser(userId) {
  const user = await findUserById(userId);

  if (!user || user.deletedAt) {
    throw new NotFoundError("Usuário de destino não encontrado.");
  }

  if (user.status !== USER_STATUS.ACTIVE) {
    throw new BadRequestError("Usuário de destino precisa estar ativo.");
  }

  return user;
}

async function ensureOwnNotification(notificationId, userId) {
  const notification = await findById(notificationId, userId);

  if (!notification) {
    throw new NotFoundError(NOT_FOUND_MESSAGE);
  }

  return notification;
}

function buildNotificationInput(payload) {
  return {
    userId: payload.userId,
    title: payload.title.trim(),
    message: payload.message.trim(),
    type: payload.type,
    metadata: payload.metadata ?? null,
  };
}

export async function createNotification(payload, options = {}) {
  await ensureActiveDestinationUser(payload.userId);

  const notification = await create(buildNotificationInput(payload));

  emitNotificationToUser(notification.userId, notification);

  if (options.emitToAdmins) {
    emitNotificationToAdmins(notification);
  }

  return notification;
}

export async function createNotificationsForAdmins(payload) {
  const admins = await findActiveAdminUsers();

  if (admins.length === 0) {
    return [];
  }

  return Promise.all(
    admins.map((admin) =>
      createNotification({
        userId: admin.id,
        title: payload.title,
        message: payload.message,
        type: payload.type,
        metadata: payload.metadata,
      }),
    ),
  );
}

export async function listOwnNotifications(query, actor) {
  const [items, total] = await Promise.all([
    listByUserId(actor.id, query),
    countByUserId(actor.id, query),
  ]);

  return {
    items,
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  };
}

export async function getUnreadNotificationsCount(actor) {
  const count = await countUnreadByUserId(actor.id);

  return { count };
}

export async function getOwnNotificationById(notificationId, actor) {
  return ensureOwnNotification(notificationId, actor.id);
}

export async function markOwnNotificationAsRead(notificationId, actor) {
  const notification = await ensureOwnNotification(notificationId, actor.id);

  return markAsRead(notification.id);
}

export async function markAllOwnNotificationsAsRead(actor) {
  const result = await markAllAsRead(actor.id);

  return {
    count: result.count,
  };
}
