import { Router } from "express";

import { ROLES } from "../../constants/roles.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import {
  reminderTemplateEmailTestPerHourRateLimiter,
  reminderTemplateEmailTestPerMinuteRateLimiter,
} from "../../middlewares/rateLimit.middleware.js";
import { authorizeRoles } from "../../middlewares/role.middleware.js";
import {
  activateReminderTemplateHandler,
  createReminderTemplateHandler,
  deactivateReminderTemplateHandler,
  getReminderTemplateByIdHandler,
  listReminderTemplatesHandler,
  previewReminderTemplateEmailHandler,
  sendReminderTemplateTestEmailHandler,
  updateReminderTemplateHandler,
} from "./reminderTemplate.controller.js";

const router = Router();

router.use(authenticate);
router.use(authorizeRoles(ROLES.ADMIN));

router.get("/", listReminderTemplatesHandler);
router.post("/email-preview", previewReminderTemplateEmailHandler);
router.post(
  "/email-test",
  reminderTemplateEmailTestPerMinuteRateLimiter,
  reminderTemplateEmailTestPerHourRateLimiter,
  sendReminderTemplateTestEmailHandler,
);
router.get("/:id", getReminderTemplateByIdHandler);
router.post("/", createReminderTemplateHandler);
router.put("/:id", updateReminderTemplateHandler);
router.patch("/:id/activate", activateReminderTemplateHandler);
router.patch("/:id/deactivate", deactivateReminderTemplateHandler);

export default router;
