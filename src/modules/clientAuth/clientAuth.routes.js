import { Router } from "express";

import { ROLES } from "../../constants/roles.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { loginRateLimiter } from "../../middlewares/rateLimit.middleware.js";
import { authorizeRoles } from "../../middlewares/role.middleware.js";
import {
  changePassword,
  google,
  login,
  logout,
  me,
  refresh,
  signup,
} from "./clientAuth.controller.js";
import { ensureClientPortalLoginEnabled } from "../clientPortal/clientPortalAccess.middleware.js";

const router = Router();

router.post("/login", loginRateLimiter, ensureClientPortalLoginEnabled, login);
router.post("/google", loginRateLimiter, ensureClientPortalLoginEnabled, google);
router.post("/signup", loginRateLimiter, ensureClientPortalLoginEnabled, signup);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/me", authenticate, authorizeRoles(ROLES.CLIENT), me);
router.patch("/password", authenticate, authorizeRoles(ROLES.CLIENT), changePassword);

export default router;
