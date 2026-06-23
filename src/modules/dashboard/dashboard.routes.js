import { Router } from "express";

import { ROLES } from "../../constants/roles.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/role.middleware.js";
import { getDashboardHandler } from "./dashboard.controller.js";

const router = Router();

router.use(authenticate, authorizeRoles(ROLES.ADMIN));

router.get("/", getDashboardHandler);

export default router;
