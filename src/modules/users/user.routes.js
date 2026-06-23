import { Router } from "express";

import { ROLES } from "../../constants/roles.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/role.middleware.js";
import {
  createUserHandler,
  deleteUserHandler,
  getUserByIdHandler,
  listUsersHandler,
  updateUserHandler,
  updateUserPasswordHandler,
  updateUserStatusHandler,
} from "./user.controller.js";

const router = Router();

router.use(authenticate, authorizeRoles(ROLES.ADMIN));

router.post("/", createUserHandler);
router.get("/", listUsersHandler);
router.get("/:id", getUserByIdHandler);
router.put("/:id", updateUserHandler);
router.patch("/:id/password", updateUserPasswordHandler);
router.patch("/:id/status", updateUserStatusHandler);
router.delete("/:id", deleteUserHandler);

export default router;
