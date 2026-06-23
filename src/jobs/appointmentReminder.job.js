import { env } from "../config/env.js";
import { processAppointmentReminders } from "../modules/appointmentReminders/appointmentReminder.service.js";

const JOB_INTERVAL_MS = 60 * 1000;

let appointmentReminderInterval = null;

export function startAppointmentReminderJob() {
  if (env.NODE_ENV === "test") {
    return null;
  }

  if (appointmentReminderInterval) {
    return appointmentReminderInterval;
  }

  if (env.isDev) {
    console.log("Appointment reminder job started");
  }

  appointmentReminderInterval = setInterval(() => {
    processAppointmentReminders().catch((error) => {
      if (env.isDev) {
        console.error("[reminder-job]", error.message);
      }
    });
  }, JOB_INTERVAL_MS);

  return appointmentReminderInterval;
}
