import { ROLES } from "../../constants/roles.js";
import { USER_STATUS } from "../../constants/userStatus.js";
import { BadRequestError } from "../../errors/BadRequestError.js";
import { ConflictError } from "../../errors/ConflictError.js";
import { ForbiddenError } from "../../errors/ForbiddenError.js";
import { NotFoundError } from "../../errors/NotFoundError.js";
import {
  create,
  findById,
  findOverlappingBlock,
  findProfessionalById,
  findProfessionalByUserId,
  list,
  remove,
  update,
} from "./recurringBlock.repository.js";

const NOT_FOUND_MESSAGE = "Bloqueio recorrente não encontrado.";
const ACCESS_DENIED_MESSAGE = "Acesso negado.";
const OVERLAP_MESSAGE =
  "Já existe um bloqueio recorrente ativo que se sobrepõe neste dia e horário.";

async function ensureProfessionalActive(professionalId) {
  const professional = await findProfessionalById(professionalId);

  if (!professional || professional.status !== USER_STATUS.ACTIVE) {
    throw new BadRequestError("Profissional não encontrado ou inativo.");
  }

  return professional;
}

function ensureAdminOrProfessional(actor) {
  if (actor.role !== ROLES.ADMIN && actor.role !== ROLES.PROFESSIONAL) {
    throw new ForbiddenError(ACCESS_DENIED_MESSAGE);
  }
}

async function ensureOwnership(actor, professionalId) {
  if (actor.role === ROLES.ADMIN) return;

  if (actor.role === ROLES.PROFESSIONAL) {
    const own = await findProfessionalByUserId(actor.id);

    if (!own || own.id !== professionalId) {
      throw new ForbiddenError(ACCESS_DENIED_MESSAGE);
    }

    return;
  }

  throw new ForbiddenError(ACCESS_DENIED_MESSAGE);
}

async function ensureBlockExists(id) {
  const block = await findById(id);
  if (!block) throw new NotFoundError(NOT_FOUND_MESSAGE);
  return block;
}

async function ensureNoOverlap(professionalId, dayOfWeek, startTime, endTime, ignoringId = null) {
  const conflict = await findOverlappingBlock(
    professionalId,
    dayOfWeek,
    startTime,
    endTime,
    ignoringId,
  );

  if (conflict) throw new ConflictError(OVERLAP_MESSAGE);
}

export async function createRecurringBlock(payload, actor) {
  await ensureProfessionalActive(payload.professionalId);
  await ensureOwnership(actor, payload.professionalId);
  await ensureNoOverlap(
    payload.professionalId,
    payload.dayOfWeek,
    payload.startTime,
    payload.endTime,
  );

  return create({
    professionalId: payload.professionalId,
    dayOfWeek: payload.dayOfWeek,
    startTime: payload.startTime,
    endTime: payload.endTime,
    reason: payload.reason,
  });
}

export async function listRecurringBlocks(query, actor) {
  ensureAdminOrProfessional(actor);

  const filters = { ...query };

  if (actor.role === ROLES.PROFESSIONAL) {
    const own = await findProfessionalByUserId(actor.id);
    filters.professionalId = own?.id ?? "none";
  }

  return list(filters);
}

export async function getRecurringBlockById(id, actor) {
  ensureAdminOrProfessional(actor);
  const block = await ensureBlockExists(id);
  await ensureOwnership(actor, block.professionalId);
  return block;
}

export async function updateRecurringBlock(id, payload, actor) {
  ensureAdminOrProfessional(actor);
  const current = await ensureBlockExists(id);
  await ensureOwnership(actor, current.professionalId);

  if (payload.isActive !== false) {
    await ensureNoOverlap(
      current.professionalId,
      payload.dayOfWeek,
      payload.startTime,
      payload.endTime,
      id,
    );
  }

  return update(id, {
    dayOfWeek: payload.dayOfWeek,
    startTime: payload.startTime,
    endTime: payload.endTime,
    reason: payload.reason,
    isActive: payload.isActive,
  });
}

export async function deleteRecurringBlock(id, actor) {
  ensureAdminOrProfessional(actor);
  const block = await ensureBlockExists(id);
  await ensureOwnership(actor, block.professionalId);
  await remove(id);
}
