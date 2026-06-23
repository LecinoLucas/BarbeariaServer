import { Router } from "express";

import { ROLES } from "../../constants/roles.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/role.middleware.js";
import {
  createProfessionalHandler,
  deleteProfessionalHandler,
  getMyProfessionalProfileHandler,
  getProfessionalByIdHandler,
  listProfessionalsHandler,
  updateProfessionalHandler,
  updateProfessionalStatusHandler,
} from "./professional.controller.js";

const router = Router();

router.use(authenticate);

router.post("/", authorizeRoles(ROLES.ADMIN), createProfessionalHandler);
router.get("/", listProfessionalsHandler);

// /me/profile deve ser registrado antes de /:id
router.get(
  "/me/profile",
  authorizeRoles(ROLES.PROFESSIONAL),
  getMyProfessionalProfileHandler,
);

router.get("/:id", getProfessionalByIdHandler);
router.put(
  "/:id",
  authorizeRoles(ROLES.ADMIN, ROLES.PROFESSIONAL),
  updateProfessionalHandler,
);
router.patch(
  "/:id/status",
  authorizeRoles(ROLES.ADMIN),
  updateProfessionalStatusHandler,
);
router.delete("/:id", authorizeRoles(ROLES.ADMIN), deleteProfessionalHandler);

export default router;
