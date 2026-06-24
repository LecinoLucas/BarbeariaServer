import { Router } from "express";

import { ROLES } from "../../constants/roles.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/role.middleware.js";
import {
  cancelClientAppointmentHandler,
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

const router = Router();

router.use(authenticate, authorizeRoles(ROLES.CLIENT));

router.get("/dashboard", getClientDashboardHandler);
router.get("/services", listClientPortalServicesHandler);
router.get("/professionals", listClientPortalProfessionalsHandler);
router.get("/availability", getClientPortalAvailabilityHandler);
router.get("/appointments", listClientAppointmentsHandler);
router.get("/attendances", listClientAttendancesHandler);
router.get("/profile", getClientProfileHandler);
router.put("/profile", updateClientProfileHandler);
router.post("/appointments/:id/cancel", cancelClientAppointmentHandler);
router.post("/appointments/:id/reschedule", rescheduleClientAppointmentHandler);

export default router;
