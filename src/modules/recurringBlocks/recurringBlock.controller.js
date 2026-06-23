import { successResponse } from "../../utils/response.js";
import {
  createRecurringBlock,
  deleteRecurringBlock,
  getRecurringBlockById,
  listRecurringBlocks,
  updateRecurringBlock,
} from "./recurringBlock.service.js";
import {
  validateCreateRecurringBlock,
  validateListRecurringBlocksQuery,
  validateUpdateRecurringBlock,
} from "./recurringBlock.validator.js";

export async function createRecurringBlockHandler(req, res, next) {
  try {
    const payload = validateCreateRecurringBlock(req.body);
    const block = await createRecurringBlock(payload, req.user);
    return successResponse(res, block, "Bloqueio recorrente criado com sucesso.", 201);
  } catch (error) {
    return next(error);
  }
}

export async function listRecurringBlocksHandler(req, res, next) {
  try {
    const query = validateListRecurringBlocksQuery(req.query);
    const blocks = await listRecurringBlocks(query, req.user);
    return successResponse(res, blocks, "Bloqueios recorrentes listados com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function getRecurringBlockByIdHandler(req, res, next) {
  try {
    const block = await getRecurringBlockById(req.params.id, req.user);
    return successResponse(res, block, "Bloqueio recorrente encontrado.");
  } catch (error) {
    return next(error);
  }
}

export async function updateRecurringBlockHandler(req, res, next) {
  try {
    const payload = validateUpdateRecurringBlock(req.body);
    const block = await updateRecurringBlock(req.params.id, payload, req.user);
    return successResponse(res, block, "Bloqueio recorrente atualizado com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function deleteRecurringBlockHandler(req, res, next) {
  try {
    await deleteRecurringBlock(req.params.id, req.user);
    return successResponse(res, null, "Bloqueio recorrente removido com sucesso.");
  } catch (error) {
    return next(error);
  }
}
