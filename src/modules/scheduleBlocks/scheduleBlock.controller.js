import { successResponse } from "../../utils/response.js";
import {
  createScheduleBlock,
  deleteScheduleBlock,
  getScheduleBlockById,
  listScheduleBlocks,
  updateScheduleBlock,
  updateScheduleBlockStatus,
} from "./scheduleBlock.service.js";
import {
  validateCreateScheduleBlock,
  validateListScheduleBlocksQuery,
  validateUpdateScheduleBlock,
  validateUpdateScheduleBlockStatus,
} from "./scheduleBlock.validator.js";

export async function createScheduleBlockHandler(req, res, next) {
  try {
    const payload = validateCreateScheduleBlock(req.body);
    const block = await createScheduleBlock(payload, req.user);
    return successResponse(res, block, "Bloqueio criado com sucesso.", 201);
  } catch (error) {
    return next(error);
  }
}

export async function listScheduleBlocksHandler(req, res, next) {
  try {
    const query = validateListScheduleBlocksQuery(req.query);
    const result = await listScheduleBlocks(query, req.user);
    return successResponse(res, result, "Bloqueios listados com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function getScheduleBlockByIdHandler(req, res, next) {
  try {
    const block = await getScheduleBlockById(req.params.id, req.user);
    return successResponse(res, block, "Bloqueio encontrado com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function updateScheduleBlockHandler(req, res, next) {
  try {
    const payload = validateUpdateScheduleBlock(req.body);
    const block = await updateScheduleBlock(req.params.id, payload, req.user);
    return successResponse(res, block, "Bloqueio atualizado com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function updateScheduleBlockStatusHandler(req, res, next) {
  try {
    const payload = validateUpdateScheduleBlockStatus(req.body);
    const block = await updateScheduleBlockStatus(req.params.id, payload, req.user);
    return successResponse(res, block, "Status do bloqueio atualizado com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function deleteScheduleBlockHandler(req, res, next) {
  try {
    await deleteScheduleBlock(req.params.id, req.user);
    return successResponse(res, null, "Bloqueio removido com sucesso.");
  } catch (error) {
    return next(error);
  }
}
