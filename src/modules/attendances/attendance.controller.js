import { successResponse } from "../../utils/response.js";
import {
  addItem,
  cancelAttendance,
  finishAttendance,
  finishAttendanceWithPayment,
  getAttendanceById,
  getAttendances,
  getItems,
  removeItem,
  startAttendance,
} from "./attendance.service.js";
import {
  validateAddAttendanceItem,
  validateFinishAttendanceWithPayment,
  validateListAttendancesQuery,
  validateStartAttendance,
} from "./attendance.validator.js";


export async function startAttendanceHandler(req, res, next) {
  try {
    const data = validateStartAttendance(req.body);
    await startAttendance(data, req.user);
    return successResponse(res, null, "Atendimento iniciado com sucesso.", 201);
  } catch (error) {
    return next(error);
  }
}

export async function listAttendancesHandler(req, res, next) {
  try {
    const query = validateListAttendancesQuery(req.query);
    const result = await getAttendances(query, req.user);
    return successResponse(res, result, "Atendimentos listados com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function getAttendanceByIdHandler(req, res, next) {
  try {
    const attendance = await getAttendanceById(req.params.id, req.user);
    return successResponse(res, attendance, "Atendimento encontrado com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function addItemHandler(req, res, next) {
  try {
    const data = validateAddAttendanceItem(req.body);
    const item = await addItem(req.params.id, data, req.user);
    return successResponse(res, item, "Item adicionado com sucesso.", 201);
  } catch (error) {
    return next(error);
  }
}

export async function listItemsHandler(req, res, next) {
  try {
    const items = await getItems(req.params.id, req.user);
    return successResponse(res, items, "Itens listados com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function removeItemHandler(req, res, next) {
  try {
    await removeItem(req.params.attendanceId, req.params.itemId, req.user);
    return successResponse(res, null, "Item removido com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function finishAttendanceHandler(req, res, next) {
  try {
    const result = await finishAttendance(req.params.id, req.user);
    return successResponse(res, result, "Atendimento finalizado com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function finishAttendanceWithPaymentHandler(req, res, next) {
  try {
    const payload = validateFinishAttendanceWithPayment(req.body);
    const result = await finishAttendanceWithPayment(req.params.id, payload, req.user);
    const message =
      payload.paymentAction === "REGISTER_LATER"
        ? "Atendimento finalizado sem registrar pagamento."
        : payload.paymentAction === "PENDING"
          ? "Atendimento finalizado com pagamento pendente registrado."
          : "Atendimento finalizado e pagamento registrado com sucesso.";

    return successResponse(
      res,
      result,
      message,
    );
  } catch (error) {
    return next(error);
  }
}

export async function cancelAttendanceHandler(req, res, next) {
  try {
    await cancelAttendance(req.params.id);
    return successResponse(res, null, "Atendimento cancelado com sucesso.");
  } catch (error) {
    return next(error);
  }
}
