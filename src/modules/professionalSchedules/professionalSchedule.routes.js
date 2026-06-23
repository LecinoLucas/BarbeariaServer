import { Router } from "express";

import { ROLES } from "../../constants/roles.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/role.middleware.js";
import {
  createProfessionalScheduleHandler,
  deleteProfessionalScheduleHandler,
  getProfessionalScheduleByIdHandler,
  listProfessionalSchedulesHandler,
  updateProfessionalScheduleHandler,
  updateProfessionalScheduleStatusHandler,
} from "./professionalSchedule.controller.js";

const router = Router();

router.use(authenticate);

router.post("/", authorizeRoles(ROLES.ADMIN), createProfessionalScheduleHandler);
router.get(
  "/",
  authorizeRoles(ROLES.ADMIN, ROLES.PROFESSIONAL, ROLES.CLIENT),
  listProfessionalSchedulesHandler,
);
router.get(
  "/:id",
  authorizeRoles(ROLES.ADMIN, ROLES.PROFESSIONAL, ROLES.CLIENT),
  getProfessionalScheduleByIdHandler,
);
router.put("/:id", authorizeRoles(ROLES.ADMIN), updateProfessionalScheduleHandler);
router.patch(
  "/:id/status",
  authorizeRoles(ROLES.ADMIN),
  updateProfessionalScheduleStatusHandler,
);
router.delete("/:id", authorizeRoles(ROLES.ADMIN), deleteProfessionalScheduleHandler);

export default router;
