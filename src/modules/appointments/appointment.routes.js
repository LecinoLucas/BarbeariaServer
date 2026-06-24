import { Router } from "express";

import { ROLES } from "../../constants/roles.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/role.middleware.js";
import {
  createAppointmentHandler,
  deleteAppointmentHandler,
  getAppointmentByIdHandler,
  getAvailabilityHandler,
  getUpcomingAlertsHandler,
  listAppointmentsByDayHandler,
  listAppointmentsByWeekHandler,
  listAppointmentsMonthSummaryHandler,
  listAppointmentsHandler,
  rescheduleAppointmentHandler,
  updateAppointmentHandler,
  updateAppointmentStatusHandler,
} from "./appointment.controller.js";

const router = Router();

router.use(authenticate);

router.post("/", createAppointmentHandler);
router.get("/", listAppointmentsHandler);
router.get("/day", listAppointmentsByDayHandler);
router.get("/week", listAppointmentsByWeekHandler);
router.get("/month-summary", listAppointmentsMonthSummaryHandler);
router.get(
  "/upcoming-alerts",
  authorizeRoles(ROLES.ADMIN, ROLES.PROFESSIONAL),
  getUpcomingAlertsHandler,
);

// /availability deve ser registrado antes de /:id
router.get("/availability", getAvailabilityHandler);

router.get("/:id", getAppointmentByIdHandler);
router.put("/:id", authorizeRoles(ROLES.ADMIN, ROLES.PROFESSIONAL), updateAppointmentHandler);
router.patch(
  "/:id/reschedule",
  authorizeRoles(ROLES.ADMIN, ROLES.PROFESSIONAL),
  rescheduleAppointmentHandler,
);
router.patch(
  "/:id/status",
  authorizeRoles(ROLES.ADMIN, ROLES.PROFESSIONAL),
  updateAppointmentStatusHandler,
);
router.delete("/:id", authorizeRoles(ROLES.ADMIN), deleteAppointmentHandler);

export default router;
