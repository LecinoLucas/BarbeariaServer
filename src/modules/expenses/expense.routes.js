import { Router } from "express";

import { ROLES } from "../../constants/roles.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/role.middleware.js";
import {
  cancelExpenseHandler,
  createExpenseHandler,
  getExpenseByIdHandler,
  listExpensesHandler,
  updateExpenseHandler,
} from "./expense.controller.js";

const router = Router();

router.use(authenticate, authorizeRoles(ROLES.ADMIN));

router.get("/", listExpensesHandler);
router.post("/", createExpenseHandler);
router.get("/:id", getExpenseByIdHandler);
router.put("/:id", updateExpenseHandler);
router.post("/:id/cancel", cancelExpenseHandler);

export default router;
