import { Router } from "express";

import { ROLES } from "../../constants/roles.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/role.middleware.js";
import {
  createNotificationHandler,
  getOwnNotificationByIdHandler,
  getUnreadNotificationsCountHandler,
  listOwnNotificationsHandler,
  markAllOwnNotificationsAsReadHandler,
  markOwnNotificationAsReadHandler,
} from "./notification.controller.js";

const router = Router();

router.use(authenticate);

router.post("/", authorizeRoles(ROLES.ADMIN), createNotificationHandler);
router.get(
  "/",
  authorizeRoles(ROLES.ADMIN, ROLES.PROFESSIONAL, ROLES.CLIENT),
  listOwnNotificationsHandler,
);
router.get(
  "/unread-count",
  authorizeRoles(ROLES.ADMIN, ROLES.PROFESSIONAL, ROLES.CLIENT),
  getUnreadNotificationsCountHandler,
);
router.patch(
  "/read-all",
  authorizeRoles(ROLES.ADMIN, ROLES.PROFESSIONAL, ROLES.CLIENT),
  markAllOwnNotificationsAsReadHandler,
);
router.get(
  "/:id",
  authorizeRoles(ROLES.ADMIN, ROLES.PROFESSIONAL, ROLES.CLIENT),
  getOwnNotificationByIdHandler,
);
router.patch(
  "/:id/read",
  authorizeRoles(ROLES.ADMIN, ROLES.PROFESSIONAL, ROLES.CLIENT),
  markOwnNotificationAsReadHandler,
);

export default router;
