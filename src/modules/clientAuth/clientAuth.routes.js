import { Router } from "express";

import { ROLES } from "../../constants/roles.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { loginRateLimiter } from "../../middlewares/rateLimit.middleware.js";
import { authorizeRoles } from "../../middlewares/role.middleware.js";
import {
  changePassword,
  login,
  logout,
  me,
  refresh,
} from "./clientAuth.controller.js";

const router = Router();

router.post("/login", loginRateLimiter, login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/me", authenticate, authorizeRoles(ROLES.CLIENT), me);
router.patch("/password", authenticate, authorizeRoles(ROLES.CLIENT), changePassword);

export default router;
