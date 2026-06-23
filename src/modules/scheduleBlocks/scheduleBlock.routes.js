import { Router } from "express";

import { ROLES } from "../../constants/roles.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/role.middleware.js";
import {
  createScheduleBlockHandler,
  deleteScheduleBlockHandler,
  getScheduleBlockByIdHandler,
  listScheduleBlocksHandler,
  updateScheduleBlockHandler,
  updateScheduleBlockStatusHandler,
} from "./scheduleBlock.controller.js";

const router = Router();

router.use(authenticate);

router.post("/", authorizeRoles(ROLES.ADMIN, ROLES.PROFESSIONAL), createScheduleBlockHandler);
router.get("/", authorizeRoles(ROLES.ADMIN, ROLES.PROFESSIONAL), listScheduleBlocksHandler);
router.get(
  "/:id",
  authorizeRoles(ROLES.ADMIN, ROLES.PROFESSIONAL),
  getScheduleBlockByIdHandler,
);
router.put(
  "/:id",
  authorizeRoles(ROLES.ADMIN, ROLES.PROFESSIONAL),
  updateScheduleBlockHandler,
);
router.patch(
  "/:id/status",
  authorizeRoles(ROLES.ADMIN, ROLES.PROFESSIONAL),
  updateScheduleBlockStatusHandler,
);
router.delete(
  "/:id",
  authorizeRoles(ROLES.ADMIN, ROLES.PROFESSIONAL),
  deleteScheduleBlockHandler,
);

export default router;
