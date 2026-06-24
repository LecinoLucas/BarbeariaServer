import { Router } from "express";

import { ROLES } from "../../constants/roles.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/role.middleware.js";
import {
  createClientHandler,
  createClientPortalAccessHandler,
  deleteClientHandler,
  getClientByIdHandler,
  listBirthdaysByMonthHandler,
  listClientsHandler,
  listTopActiveClientsHandler,
  resetClientPortalPasswordHandler,
  updateClientHandler,
  updateClientPortalAccessStatusHandler,
  updateClientStatusHandler,
} from "./client.controller.js";

const router = Router();

router.use(authenticate);

router.post("/", authorizeRoles(ROLES.ADMIN, ROLES.PROFESSIONAL), createClientHandler);
router.get("/", authorizeRoles(ROLES.ADMIN, ROLES.PROFESSIONAL), listClientsHandler);
router.get(
  "/birthdays/month",
  authorizeRoles(ROLES.ADMIN, ROLES.PROFESSIONAL),
  listBirthdaysByMonthHandler,
);
router.get(
  "/top/active",
  authorizeRoles(ROLES.ADMIN, ROLES.PROFESSIONAL),
  listTopActiveClientsHandler,
);
router.post("/:id/portal-access", authorizeRoles(ROLES.ADMIN), createClientPortalAccessHandler);
router.patch(
  "/:id/portal-access/password",
  authorizeRoles(ROLES.ADMIN),
  resetClientPortalPasswordHandler,
);
router.patch(
  "/:id/portal-access/status",
  authorizeRoles(ROLES.ADMIN),
  updateClientPortalAccessStatusHandler,
);
router.get("/:id", getClientByIdHandler);
router.put("/:id", updateClientHandler);
router.patch(
  "/:id/status",
  authorizeRoles(ROLES.ADMIN, ROLES.PROFESSIONAL),
  updateClientStatusHandler,
);
router.delete("/:id", authorizeRoles(ROLES.ADMIN), deleteClientHandler);

export default router;
