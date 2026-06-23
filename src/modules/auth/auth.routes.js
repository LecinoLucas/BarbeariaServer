import { Router } from "express";

import { authenticate } from "../../middlewares/auth.middleware.js";
import { loginRateLimiter } from "../../middlewares/rateLimit.middleware.js";
import { login, logout, me, refresh } from "./auth.controller.js";

const router = Router();

router.post("/login", loginRateLimiter, login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/me", authenticate, me);

export default router;
