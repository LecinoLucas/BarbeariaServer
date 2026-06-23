import { ROLES } from "../../constants/roles.js";
import { USER_STATUS } from "../../constants/userStatus.js";
import { BadRequestError } from "../../errors/BadRequestError.js";
import { ConflictError } from "../../errors/ConflictError.js";
import { ForbiddenError } from "../../errors/ForbiddenError.js";
import { NotFoundError } from "../../errors/NotFoundError.js";
import {
  count,
  create,
  findById,
  findConflictingAppointment,
  findConflictingBlock,
  findProfessionalById,
  findProfessionalByUserId,
  list,
  softDelete,
  update,
  updateStatus,
} from "./scheduleBlock.repository.js";

const NOT_FOUND_MESSAGE = "Bloqueio de agenda não encontrado.";
const ACCESS_DENIED_MESSAGE = "Acesso negado.";
const BLOCK_CONFLICT_MESSAGE =
  "Já existe um bloqueio ativo conflitante para este profissional.";
const APPOINTMENT_CONFLICT_MESSAGE =
  "Não é possível salvar bloqueio em horário com agendamento ativo.";

async function ensureProfessionalValid(professionalId) {
  const professional = await findProfessionalById(professionalId);

  if (!professional || professional.status !== USER_STATUS.ACTIVE) {
    throw new BadRequestError("Profissional não encontrado ou inativo.");
  }

  return professional;
}

async function ensureOwnProfessional(userId, professionalId) {
  const professional = await findProfessionalByUserId(userId);

  if (!professional || professional.id !== professionalId) {
    throw new ForbiddenError(ACCESS_DENIED_MESSAGE);
  }
}

async function ensureScheduleBlockExists(id) {
  const block = await findById(id);

  if (!block) {
    throw new NotFoundError(NOT_FOUND_MESSAGE);
  }

  return block;
}

async function ensureOwnership(actor, professionalId) {
  if (actor.role === ROLES.ADMIN) return;

  if (actor.role === ROLES.PROFESSIONAL) {
    await ensureOwnProfessional(actor.id, professionalId);
    return;
  }

  throw new ForbiddenError(ACCESS_DENIED_MESSAGE);
}

async function ensureBlockAccess(actor, block) {
  await ensureOwnership(actor, block.professionalId);
}

async function ensureNoConflicts(professionalId, startAt, endAt, ignoringId = null) {
  const [conflictingBlock, conflictingAppointment] = await Promise.all([
    findConflictingBlock(professionalId, startAt, endAt, ignoringId),
    findConflictingAppointment(professionalId, startAt, endAt, ignoringId),
  ]);

  if (conflictingBlock) {
    throw new ConflictError(BLOCK_CONFLICT_MESSAGE);
  }

  if (conflictingAppointment) {
    throw new ConflictError(APPOINTMENT_CONFLICT_MESSAGE);
  }
}

async function buildListFilters(query, actor) {
  const filters = { ...query };

  if (actor.role === ROLES.ADMIN) {
    return filters;
  }

  if (actor.role === ROLES.PROFESSIONAL) {
    const professional = await findProfessionalByUserId(actor.id);
    filters.professionalId = professional?.id ?? "none";
    return filters;
  }

  throw new ForbiddenError(ACCESS_DENIED_MESSAGE);
}

export async function createScheduleBlock(payload, actor) {
  await ensureProfessionalValid(payload.professionalId);
  await ensureOwnership(actor, payload.professionalId);
  await ensureNoConflicts(payload.professionalId, payload.startAt, payload.endAt);

  return create({
    professionalId: payload.professionalId,
    title: payload.title.trim(),
    reason: payload.reason,
    startAt: payload.startAt,
    endAt: payload.endAt,
  });
}

export async function listScheduleBlocks(query, actor) {
  const filters = await buildListFilters(query, actor);
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

export async function getScheduleBlockById(id, actor) {
  const block = await ensureScheduleBlockExists(id);
  await ensureBlockAccess(actor, block);
  return block;
}

export async function updateScheduleBlock(id, payload, actor) {
  const current = await ensureScheduleBlockExists(id);
  await ensureBlockAccess(actor, current);

  if (payload.isActive) {
    await ensureNoConflicts(current.professionalId, payload.startAt, payload.endAt, id);
  }

  return update(id, {
    title: payload.title.trim(),
    reason: payload.reason,
    startAt: payload.startAt,
    endAt: payload.endAt,
    isActive: payload.isActive,
  });
}

export async function updateScheduleBlockStatus(id, payload, actor) {
  const current = await ensureScheduleBlockExists(id);
  await ensureBlockAccess(actor, current);

  if (payload.isActive) {
    await ensureNoConflicts(current.professionalId, current.startAt, current.endAt, id);
  }

  return updateStatus(id, payload.isActive);
}

export async function deleteScheduleBlock(id, actor) {
  const current = await ensureScheduleBlockExists(id);
  await ensureBlockAccess(actor, current);
  await softDelete(id);
}
