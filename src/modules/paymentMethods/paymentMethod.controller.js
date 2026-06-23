import { successResponse } from "../../utils/response.js";
import {
  createPaymentMethod,
  getPaymentMethodById,
  listPaymentMethods,
  removePaymentMethod,
  updatePaymentMethod,
} from "./paymentMethod.service.js";
import {
  validateCreatePaymentMethod,
  validateListPaymentMethodsQuery,
  validateUpdatePaymentMethod,
} from "./paymentMethod.validator.js";

export async function listPaymentMethodsHandler(req, res, next) {
  try {
    const query = validateListPaymentMethodsQuery(req.query);
    const result = await listPaymentMethods(query);
    return successResponse(res, result, "Formas de pagamento listadas com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function getPaymentMethodByIdHandler(req, res, next) {
  try {
    const method = await getPaymentMethodById(req.params.id);
    return successResponse(res, method, "Forma de pagamento encontrada com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function createPaymentMethodHandler(req, res, next) {
  try {
    const payload = validateCreatePaymentMethod(req.body);
    const method = await createPaymentMethod(payload);
    return successResponse(res, method, "Forma de pagamento criada com sucesso.", 201);
  } catch (error) {
    return next(error);
  }
}

export async function updatePaymentMethodHandler(req, res, next) {
  try {
    const payload = validateUpdatePaymentMethod(req.body);
    const method = await updatePaymentMethod(req.params.id, payload);
    return successResponse(res, method, "Forma de pagamento atualizada com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function removePaymentMethodHandler(req, res, next) {
  try {
    const method = await removePaymentMethod(req.params.id);
    return successResponse(res, method, "Forma de pagamento inativada com sucesso.");
  } catch (error) {
    return next(error);
  }
}
