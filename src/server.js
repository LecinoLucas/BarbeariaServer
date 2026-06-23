import http from "http";

import { env } from "./config/env.js";
import app from "./app.js";
import { startAppointmentReminderJob } from "./jobs/appointmentReminder.job.js";
import { setupSocket } from "./socket/socket.server.js";

const server = http.createServer(app);

setupSocket(server);

server.listen(env.PORT, () => {
  console.log(`[${env.NODE_ENV}] Server running on port ${env.PORT}`);

  startAppointmentReminderJob();
});
