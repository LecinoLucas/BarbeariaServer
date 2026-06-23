import { Router } from "express";

import { ROLES } from "../../constants/roles.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/role.middleware.js";
import {
  cancelPaymentHandler,
  createPaymentHandler,
  getFinancialSummaryHandler,
  getPaymentByIdHandler,
  listPaymentsHandler,
  payPaymentHandler,
  updateDiscountHandler,
} from "./payment.controller.js";

const router = Router();

router.use(authenticate);
router.use(authorizeRoles(ROLES.ADMIN, ROLES.PROFESSIONAL));

// Rotas específicas devem vir antes de /:id
router.post("/create", createPaymentHandler);
router.get("/summary", authorizeRoles(ROLES.ADMIN), getFinancialSummaryHandler);

router.get("/", listPaymentsHandler);
router.get("/:id", getPaymentByIdHandler);

router.patch("/:id/discount", authorizeRoles(ROLES.ADMIN), updateDiscountHandler);
router.post("/:id/pay", payPaymentHandler);
router.post("/:id/cancel", authorizeRoles(ROLES.ADMIN), cancelPaymentHandler);

export default router;
