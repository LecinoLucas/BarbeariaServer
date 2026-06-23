import { Router } from "express";

import { ROLES } from "../../constants/roles.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/role.middleware.js";
import {
  createServiceHandler,
  deleteServiceHandler,
  getServiceByIdHandler,
  listServicesHandler,
  updateServiceHandler,
  updateServiceStatusHandler,
} from "./service.controller.js";

const router = Router();

router.use(authenticate);

router.post("/", authorizeRoles(ROLES.ADMIN), createServiceHandler);
router.get("/", listServicesHandler);
router.get("/:id", getServiceByIdHandler);
router.put("/:id", authorizeRoles(ROLES.ADMIN), updateServiceHandler);
router.patch("/:id/status", authorizeRoles(ROLES.ADMIN), updateServiceStatusHandler);
router.delete("/:id", authorizeRoles(ROLES.ADMIN), deleteServiceHandler);

export default router;
