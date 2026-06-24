import { Router } from "express";
import {
  getPublicPortalHandler,
  getPublicProductsHandler,
  getPublicServicesHandler,
} from "./public.controller.js";

const router = Router();

// No authentication required — these are open public endpoints.
// Rate limiting is already applied globally via apiRateLimiter in app.js.

router.get("/portal", getPublicPortalHandler);
router.get("/services", getPublicServicesHandler);
router.get("/products", getPublicProductsHandler);

export default router;
