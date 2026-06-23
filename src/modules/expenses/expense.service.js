import { BadRequestError } from "../../errors/BadRequestError.js";
import { NotFoundError } from "../../errors/NotFoundError.js";
import { cancel, count, create, findById, list, update } from "./expense.repository.js";

const NOT_FOUND = "Despesa não encontrada.";

export async function createExpense(payload) {
  return create({
    description: payload.description,
    amountCents: payload.amountCents,
    category: payload.category ?? null,
    expenseDate: new Date(`${payload.expenseDate}T00:00:00.000Z`),
    notes: payload.notes ?? null,
    createdByUserId: payload.createdByUserId ?? null,
  });
}

export async function getExpenseById(id) {
  const expense = await findById(id);
  if (!expense) throw new NotFoundError(NOT_FOUND);
  return expense;
}

export async function updateExpense(id, payload) {
  const expense = await findById(id);
  if (!expense) throw new NotFoundError(NOT_FOUND);
  if (expense.status === "CANCELED") {
    throw new BadRequestError("Não é possível editar uma despesa cancelada.");
  }

  return update(id, {
    description: payload.description,
    amountCents: payload.amountCents,
    category: payload.category ?? null,
    expenseDate: new Date(`${payload.expenseDate}T00:00:00.000Z`),
    notes: payload.notes ?? null,
  });
}

export async function cancelExpense(id) {
  const expense = await findById(id);
  if (!expense) throw new NotFoundError(NOT_FOUND);
  if (expense.status === "CANCELED") {
    throw new BadRequestError("Despesa já está cancelada.");
  }
  return cancel(id);
}

export async function listExpenses(filters) {
  const [items, total] = await Promise.all([list(filters), count(filters)]);

  return {
    items,
    meta: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / filters.limit),
    },
  };
}
