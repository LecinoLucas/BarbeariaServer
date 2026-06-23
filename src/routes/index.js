import { Router } from "express";
import appointmentRoutes from "../modules/appointments/appointment.routes.js";
import attendanceRoutes from "../modules/attendances/attendance.routes.js";
import paymentRoutes from "../modules/payments/payment.routes.js";
import paymentMethodRoutes from "../modules/paymentMethods/paymentMethod.routes.js";
import settingsRoutes from "../modules/settings/settings.routes.js";
import authRoutes from "../modules/auth/auth.routes.js";
import appointmentReminderRoutes from "../modules/appointmentReminders/appointmentReminder.routes.js";
import clientRoutes from "../modules/clients/client.routes.js";
import clientPortalRoutes from "../modules/clientPortal/clientPortal.routes.js";
import dashboardRoutes from "../modules/dashboard/dashboard.routes.js";
import notificationRoutes from "../modules/notifications/notification.routes.js";
import professionalRoutes from "../modules/professionals/professional.routes.js";
import professionalScheduleRoutes from "../modules/professionalSchedules/professionalSchedule.routes.js";
import scheduleBlockRoutes from "../modules/scheduleBlocks/scheduleBlock.routes.js";
import recurringBlockRoutes from "../modules/recurringBlocks/recurringBlock.routes.js";
import reminderTemplateRoutes from "../modules/reminderTemplates/reminderTemplate.routes.js";
import serviceRoutes from "../modules/services/service.routes.js";
import productRoutes from "../modules/products/product.routes.js";
import userRoutes from "../modules/users/user.routes.js";
import prisma from "../database/prisma.js";

const router = Router();

router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "alphamen.barbearia API online",
  });
});

router.get("/ready", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return res.json({
      success: true,
      message: "alphamen.barbearia API ready",
      data: {
        database: "connected",
      },
    });
  } catch {
    return res.status(503).json({
      success: false,
      message: "Serviço indisponível.",
      error: {
        code: "SERVICE_UNAVAILABLE",
        details: [
          {
            service: "database",
            status: "disconnected",
          },
        ],
      },
    });
  }
});

router.use("/auth", authRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/users", userRoutes);
router.use("/clients", clientRoutes);
router.use("/client-portal", clientPortalRoutes);
router.use("/notifications", notificationRoutes);
router.use("/professionals", professionalRoutes);
router.use("/professional-schedules", professionalScheduleRoutes);
router.use("/schedule-blocks", scheduleBlockRoutes);
router.use("/professional-recurring-blocks", recurringBlockRoutes);
router.use("/services", serviceRoutes);
router.use("/products", productRoutes);
router.use("/reminder-templates", reminderTemplateRoutes);
router.use("/appointments", appointmentRoutes);
router.use("/appointment-reminders", appointmentReminderRoutes);
router.use("/attendances", attendanceRoutes);
router.use("/payments", paymentRoutes);
router.use("/payment-methods", paymentMethodRoutes);
router.use("/settings", settingsRoutes);

export default router;
