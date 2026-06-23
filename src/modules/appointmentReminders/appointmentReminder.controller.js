import { env } from "../../config/env.js";
import { NotFoundError } from "../../errors/NotFoundError.js";
import { successResponse } from "../../utils/response.js";
import {
  listAppointmentReminders,
  processAppointmentReminders,
} from "./appointmentReminder.service.js";
import {
  validateListAppointmentRemindersQuery,
  validateProcessAppointmentReminders,
} from "./appointmentReminder.validator.js";

export async function listAppointmentRemindersHandler(req, res, next) {
  try {
    const query = validateListAppointmentRemindersQuery(req.query);
    const data = await listAppointmentReminders(query, req.user);

    return successResponse(res, data, "Lembretes de agendamento listados com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function processAppointmentRemindersHandler(req, res, next) {
  try {
    if (!env.isDev) {
      throw new NotFoundError("Rota não encontrada.");
    }

    const payload = validateProcessAppointmentReminders(req.body);
    const data = await processAppointmentReminders({
      limit: payload.limit,
    });

    return successResponse(res, data, "Lote de lembretes processado com sucesso.");
  } catch (error) {
    return next(error);
  }
}
