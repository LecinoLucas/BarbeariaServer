import { Router } from "express";

import { ROLES } from "../../constants/roles.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/role.middleware.js";
import { getSettingsHandler, updateSettingsHandler } from "./settings.controller.js";

const router = Router();

router.use(authenticate);
router.use(authorizeRoles(ROLES.ADMIN));

router.get("/", getSettingsHandler);
router.put("/", updateSettingsHandler);

export default router;
