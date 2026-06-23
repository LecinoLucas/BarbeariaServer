import { successResponse } from "../../utils/response.js";
import {
  createNotification,
  getOwnNotificationById,
  getUnreadNotificationsCount,
  listOwnNotifications,
  markAllOwnNotificationsAsRead,
  markOwnNotificationAsRead,
} from "./notification.service.js";
import {
  validateCreateNotification,
  validateListNotificationsQuery,
} from "./notification.validator.js";


export async function createNotificationHandler(req, res, next) {
  try {
    const data = validateCreateNotification(req.body);
    const notification = await createNotification(data);

    return successResponse(res, notification, "Notificação criada com sucesso.", 201);
  } catch (error) {
    return next(error);
  }
}

export async function listOwnNotificationsHandler(req, res, next) {
  try {
    const query = validateListNotificationsQuery(req.query);
    const result = await listOwnNotifications(query, req.user);

    return successResponse(res, result, "Notificações listadas com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function getUnreadNotificationsCountHandler(req, res, next) {
  try {
    const data = await getUnreadNotificationsCount(req.user);

    return successResponse(res, data, "Contagem de notificações não lidas carregada com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function getOwnNotificationByIdHandler(req, res, next) {
  try {
    const notification = await getOwnNotificationById(req.params.id, req.user);

    return successResponse(res, notification, "Notificação encontrada com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function markOwnNotificationAsReadHandler(req, res, next) {
  try {
    const notification = await markOwnNotificationAsRead(req.params.id, req.user);

    return successResponse(res, notification, "Notificação marcada como lida com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function markAllOwnNotificationsAsReadHandler(req, res, next) {
  try {
    const data = await markAllOwnNotificationsAsRead(req.user);

    return successResponse(res, data, "Notificações marcadas como lidas com sucesso.");
  } catch (error) {
    return next(error);
  }
}
