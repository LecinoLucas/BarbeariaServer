import { getIO } from "./socket.server.js";
import { SOCKET_EVENTS } from "./socket.events.js";

function getEmitter() {
  return getIO();
}

function toNotificationSocketPayload(notification) {
  return {
    id: notification.id,
    title: notification.title,
    message: notification.message,
    type: notification.type,
    readAt: notification.readAt,
    metadata: notification.metadata,
    createdAt: notification.createdAt,
  };
}

export function emitToUser(userId, event, payload) {
  const io = getEmitter();

  if (!io || !userId) {
    return;
  }

  io.to(`user:${userId}`).emit(event, payload);
}

export function emitToAdmins(event, payload) {
  const io = getEmitter();

  if (!io) {
    return;
  }

  io.to("admins").emit(event, payload);
}

export function emitNotificationToUser(userId, notification) {
  emitToUser(userId, SOCKET_EVENTS.NOTIFICATION_CREATED, toNotificationSocketPayload(notification));
}

export function emitNotificationToAdmins(notification) {
  emitToAdmins(
    SOCKET_EVENTS.NOTIFICATION_CREATED,
    toNotificationSocketPayload(notification),
  );
}
