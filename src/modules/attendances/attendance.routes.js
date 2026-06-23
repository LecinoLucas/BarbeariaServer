import { Router } from "express";

import { ROLES } from "../../constants/roles.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/role.middleware.js";
import {
  addItemHandler,
  cancelAttendanceHandler,
  finishAttendanceHandler,
  finishAttendanceWithPaymentHandler,
  getAttendanceByIdHandler,
  listAttendancesHandler,
  listItemsHandler,
  removeItemHandler,
  startAttendanceHandler,
} from "./attendance.controller.js";

const router = Router();

router.use(authenticate);
router.use(authorizeRoles(ROLES.ADMIN, ROLES.PROFESSIONAL));

// /start deve ser registrado antes de /:id
router.post("/start", startAttendanceHandler);

router.get("/", listAttendancesHandler);
router.get("/:id", getAttendanceByIdHandler);

router.post("/:id/items", addItemHandler);
router.get("/:id/items", listItemsHandler);

router.delete(
  "/:attendanceId/items/:itemId",
  removeItemHandler,
);

router.post("/:id/finish-with-payment", finishAttendanceWithPaymentHandler);
router.post("/:id/finish", finishAttendanceHandler);
router.post("/:id/cancel", authorizeRoles(ROLES.ADMIN), cancelAttendanceHandler);

export default router;
