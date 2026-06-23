import { Router } from "express";
import express from "express";

import { ROLES } from "../../constants/roles.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/role.middleware.js";
import {
  getLoginAppearanceHandler,
  getPublicLoginAppearanceHandler,
  getSettingsHandler,
  restoreDefaultLoginAppearanceHandler,
  updateLoginAppearanceHandler,
  updateSettingsHandler,
  uploadLoginAppearanceBackgroundHandler,
} from "./settings.controller.js";
import { MAX_BACKGROUND_IMAGE_SIZE_BYTES } from "./settings.service.js";

const router = Router();

router.get("/public/login-appearance", getPublicLoginAppearanceHandler);

router.use(authenticate);
router.use(authorizeRoles(ROLES.ADMIN));

router.get("/", getSettingsHandler);
router.put("/", updateSettingsHandler);
router.get("/login-appearance", getLoginAppearanceHandler);
router.put("/login-appearance", updateLoginAppearanceHandler);
router.delete("/login-appearance", restoreDefaultLoginAppearanceHandler);
router.post(
  "/login-appearance/background",
  express.raw({
    type: () => true,
    limit: MAX_BACKGROUND_IMAGE_SIZE_BYTES,
  }),
  uploadLoginAppearanceBackgroundHandler,
);

export default router;
