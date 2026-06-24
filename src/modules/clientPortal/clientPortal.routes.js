import { Router } from "express";

import { ROLES } from "../../constants/roles.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/role.middleware.js";
import {
  cancelClientAppointmentHandler,
  createClientAppointmentHandler,
  getClientPortalConfigHandler,
  getClientPortalAvailabilityHandler,
  getClientDashboardHandler,
  getClientProfileHandler,
  listClientAppointmentsHandler,
  listClientPortalProfessionalsHandler,
  listClientPortalServicesHandler,
  listClientAttendancesHandler,
  rescheduleClientAppointmentHandler,
  updateClientProfileHandler,
} from "./clientPortal.controller.js";
import { ensureClientPortalEnabled } from "./clientPortalAccess.middleware.js";

const router = Router();

router.get("/config", getClientPortalConfigHandler);

router.use(authenticate, authorizeRoles(ROLES.CLIENT));
router.use(ensureClientPortalEnabled);

router.get("/dashboard", getClientDashboardHandler);
router.get("/services", listClientPortalServicesHandler);
router.get("/professionals", listClientPortalProfessionalsHandler);
router.get("/availability", getClientPortalAvailabilityHandler);
router.post("/appointments", createClientAppointmentHandler);
router.get("/appointments", listClientAppointmentsHandler);
router.get("/attendances", listClientAttendancesHandler);
router.get("/profile", getClientProfileHandler);
router.put("/profile", updateClientProfileHandler);
router.patch("/appointments/:id/cancel", cancelClientAppointmentHandler);
router.post("/appointments/:id/cancel", cancelClientAppointmentHandler);
router.post("/appointments/:id/reschedule", rescheduleClientAppointmentHandler);

export default router;
