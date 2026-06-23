import { successResponse } from "../../utils/response.js";
import {
  cancelExpense,
  createExpense,
  getExpenseById,
  listExpenses,
  updateExpense,
} from "./expense.service.js";
import {
  validateCreateExpense,
  validateListExpensesQuery,
  validateUpdateExpense,
} from "./expense.validator.js";

export async function createExpenseHandler(req, res, next) {
  try {
    const payload = validateCreateExpense(req.body);
    const expense = await createExpense({ ...payload, createdByUserId: req.user.id });
    return successResponse(res, expense, "Despesa cadastrada com sucesso.", 201);
  } catch (error) {
    return next(error);
  }
}

export async function listExpensesHandler(req, res, next) {
  try {
    const query = validateListExpensesQuery(req.query);
    const result = await listExpenses(query);
    return successResponse(res, result, "Despesas listadas com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function getExpenseByIdHandler(req, res, next) {
  try {
    const expense = await getExpenseById(req.params.id);
    return successResponse(res, expense, "Despesa encontrada com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function updateExpenseHandler(req, res, next) {
  try {
    const payload = validateUpdateExpense(req.body);
    const expense = await updateExpense(req.params.id, payload);
    return successResponse(res, expense, "Despesa atualizada com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function cancelExpenseHandler(req, res, next) {
  try {
    const expense = await cancelExpense(req.params.id);
    return successResponse(res, expense, "Despesa cancelada com sucesso.");
  } catch (error) {
    return next(error);
  }
}
