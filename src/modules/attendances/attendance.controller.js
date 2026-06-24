import { successResponse } from "../../utils/response.js";
import {
  addItem,
  addProduct,
  cancelAttendance,
  finishAttendance,
  finishAttendanceWithPayment,
  getAttendanceById,
  getAttendances,
  getItems,
  getProducts,
  removeItem,
  removeProduct,
  startAttendance,
  updateProductQuantity,
} from "./attendance.service.js";
import {
  getAttendanceReceiptData,
  renderAttendanceReceiptPdf,
} from "./attendance.receipt.service.js";
import {
  validateAddAttendanceItem,
  validateAddAttendanceProduct,
  validateFinishAttendanceWithPayment,
  validateListAttendancesQuery,
  validateStartAttendance,
  validateUpdateAttendanceProduct,
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

export async function addProductHandler(req, res, next) {
  try { return successResponse(res, await addProduct(req.params.attendanceId, validateAddAttendanceProduct(req.body), req.user), "Produto adicionado com sucesso.", 201); } catch (error) { return next(error); }
}

export async function listProductsHandler(req, res, next) {
  try { return successResponse(res, await getProducts(req.params.attendanceId, req.user), "Produtos listados com sucesso."); } catch (error) { return next(error); }
}

export async function updateProductQuantityHandler(req, res, next) {
  try { return successResponse(res, await updateProductQuantity(req.params.attendanceId, req.params.itemId, validateUpdateAttendanceProduct(req.body), req.user), "Quantidade atualizada com sucesso."); } catch (error) { return next(error); }
}

export async function removeProductHandler(req, res, next) {
  try { await removeProduct(req.params.attendanceId, req.params.itemId, req.user); return successResponse(res, null, "Produto removido com sucesso."); } catch (error) { return next(error); }
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

export async function getAttendanceReceiptPdfHandler(req, res, next) {
  try {
    const receiptData = await getAttendanceReceiptData(req.params.id, req.user);
    const download = req.query.download === "true";
    const shortId = req.params.id.slice(0, 8).toUpperCase();
    const filename = `comprovante-atendimento-${shortId}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `${download ? "attachment" : "inline"}; filename="${filename}"`,
    );

    const doc = renderAttendanceReceiptPdf(receiptData);
    doc.pipe(res);
    doc.end();
  } catch (error) {
    return next(error);
  }
}
