import { BadRequestError } from "../../errors/BadRequestError.js";
import { ConflictError } from "../../errors/ConflictError.js";
import { NotFoundError } from "../../errors/NotFoundError.js";
import {
  count,
  countPaymentsUsingMethod,
  create,
  deactivate,
  findByCode,
  findByCodeIgnoringId,
  findById,
  list,
  update,
} from "./paymentMethod.repository.js";

const NOT_FOUND_MESSAGE = "Forma de pagamento não encontrada.";

export async function listPaymentMethods(query) {
  const filters = {
    ...query,
    isActive: query.isActive !== undefined ? query.isActive : undefined,
  };

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

export async function getPaymentMethodById(id) {
  const method = await findById(id);
  if (!method) throw new NotFoundError(NOT_FOUND_MESSAGE);
  return method;
}

export async function createPaymentMethod(payload) {
  const code = payload.code.toUpperCase().replace(/\s+/g, "_");

  const existing = await findByCode(code);
  if (existing) throw new ConflictError("Já existe uma forma de pagamento com este código.");

  return create({ ...payload, code });
}

export async function updatePaymentMethod(id, payload) {
  const method = await findById(id);
  if (!method) throw new NotFoundError(NOT_FOUND_MESSAGE);

  const code = payload.code ? payload.code.toUpperCase().replace(/\s+/g, "_") : method.code;

  if (code !== method.code) {
    const conflict = await findByCodeIgnoringId(code, id);
    if (conflict) throw new ConflictError("Já existe uma forma de pagamento com este código.");
  }

  return update(id, { ...payload, code });
}

export async function removePaymentMethod(id) {
  const method = await findById(id);
  if (!method) throw new NotFoundError(NOT_FOUND_MESSAGE);

  const linkedCount = await countPaymentsUsingMethod(id);

  if (linkedCount > 0) {
    return deactivate(id);
  }

  return deactivate(id);
}
