import { Router } from "express";
import { ROLES } from "../../constants/roles.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/role.middleware.js";
import { createProductHandler, getProductByIdHandler, listProductsHandler, updateProductHandler, updateProductStatusHandler } from "./product.controller.js";

const router = Router();
router.use(authenticate);
router.use(authorizeRoles(ROLES.ADMIN, ROLES.PROFESSIONAL));
router.get("/", listProductsHandler);
router.get("/:id", getProductByIdHandler);
router.post("/", authorizeRoles(ROLES.ADMIN), createProductHandler);
router.put("/:id", authorizeRoles(ROLES.ADMIN), updateProductHandler);
router.patch("/:id/status", authorizeRoles(ROLES.ADMIN), updateProductStatusHandler);
export default router;
