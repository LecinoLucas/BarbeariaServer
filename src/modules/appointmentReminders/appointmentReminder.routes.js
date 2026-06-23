import { Router } from "express";

import { ROLES } from "../../constants/roles.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/role.middleware.js";
import {
  listAppointmentRemindersHandler,
  processAppointmentRemindersHandler,
} from "./appointmentReminder.controller.js";

const router = Router();

router.use(authenticate);

router.get("/", authorizeRoles(ROLES.ADMIN, ROLES.PROFESSIONAL), listAppointmentRemindersHandler);
router.post("/process", authorizeRoles(ROLES.ADMIN), processAppointmentRemindersHandler);

export default router;
