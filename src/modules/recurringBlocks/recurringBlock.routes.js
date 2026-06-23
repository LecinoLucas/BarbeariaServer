import { Router } from "express";

import { ROLES } from "../../constants/roles.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/role.middleware.js";
import {
  createRecurringBlockHandler,
  deleteRecurringBlockHandler,
  getRecurringBlockByIdHandler,
  listRecurringBlocksHandler,
  updateRecurringBlockHandler,
} from "./recurringBlock.controller.js";

const router = Router();

router.use(authenticate);

router.post("/", authorizeRoles(ROLES.ADMIN, ROLES.PROFESSIONAL), createRecurringBlockHandler);
router.get("/", authorizeRoles(ROLES.ADMIN, ROLES.PROFESSIONAL), listRecurringBlocksHandler);
router.get("/:id", authorizeRoles(ROLES.ADMIN, ROLES.PROFESSIONAL), getRecurringBlockByIdHandler);
router.put("/:id", authorizeRoles(ROLES.ADMIN, ROLES.PROFESSIONAL), updateRecurringBlockHandler);
router.delete("/:id", authorizeRoles(ROLES.ADMIN, ROLES.PROFESSIONAL), deleteRecurringBlockHandler);

export default router;
