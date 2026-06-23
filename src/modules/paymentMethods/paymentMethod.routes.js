import { Router } from "express";
import { ROLES } from "../../constants/roles.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/role.middleware.js";
import {
  createPaymentMethodHandler,
  getPaymentMethodByIdHandler,
  listPaymentMethodsHandler,
  removePaymentMethodHandler,
  updatePaymentMethodHandler,
} from "./paymentMethod.controller.js";

const router = Router();

router.use(authenticate);

router.get("/", authorizeRoles(ROLES.ADMIN, ROLES.PROFESSIONAL), listPaymentMethodsHandler);
router.get("/:id", authorizeRoles(ROLES.ADMIN, ROLES.PROFESSIONAL), getPaymentMethodByIdHandler);

router.post("/", authorizeRoles(ROLES.ADMIN), createPaymentMethodHandler);
router.put("/:id", authorizeRoles(ROLES.ADMIN), updatePaymentMethodHandler);
router.delete("/:id", authorizeRoles(ROLES.ADMIN), removePaymentMethodHandler);

export default router;
