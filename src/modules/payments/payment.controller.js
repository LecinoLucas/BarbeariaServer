import { successResponse } from "../../utils/response.js";
import {
  cancelPayment,
  createPayment,
  getFinancialSummaryService,
  getPaymentById,
  listPayments,
  payPayment,
  updateDiscount,
} from "./payment.service.js";
import {
  validateCreatePayment,
  validateListPaymentsQuery,
  validatePayPayment,
  validateSummaryQuery,
  validateUpdateDiscount,
} from "./payment.validator.js";

export async function createPaymentHandler(req, res, next) {
  try {
    const payload = validateCreatePayment(req.body);
    const payment = await createPayment(payload);
    return successResponse(res, payment, "Pagamento gerado com sucesso.", 201);
  } catch (error) {
    return next(error);
  }
}

export async function listPaymentsHandler(req, res, next) {
  try {
    const query = validateListPaymentsQuery(req.query);
    const result = await listPayments(query, req.user);
    return successResponse(res, result, "Pagamentos listados com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function getFinancialSummaryHandler(req, res, next) {
  try {
    const query = validateSummaryQuery(req.query);
    const result = await getFinancialSummaryService(query);
    return successResponse(res, result, "Resumo financeiro gerado com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function getPaymentByIdHandler(req, res, next) {
  try {
    const payment = await getPaymentById(req.params.id, req.user);
    return successResponse(res, payment, "Pagamento encontrado com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function updateDiscountHandler(req, res, next) {
  try {
    const payload = validateUpdateDiscount(req.body);
    const payment = await updateDiscount(req.params.id, payload);
    return successResponse(res, payment, "Desconto aplicado com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function payPaymentHandler(req, res, next) {
  try {
    const payload = validatePayPayment(req.body);
    const payment = await payPayment(req.params.id, payload, req.user);
    return successResponse(res, payment, "Pagamento recebido com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function cancelPaymentHandler(req, res, next) {
  try {
    const payment = await cancelPayment(req.params.id);
    return successResponse(res, payment, "Pagamento cancelado com sucesso.");
  } catch (error) {
    return next(error);
  }
}
