import { ROLES } from "../../constants/roles.js";
import { USER_STATUS } from "../../constants/userStatus.js";
import { BadRequestError } from "../../errors/BadRequestError.js";
import { ConflictError } from "../../errors/ConflictError.js";
import { ForbiddenError } from "../../errors/ForbiddenError.js";
import { NotFoundError } from "../../errors/NotFoundError.js";
import { UnauthorizedError } from "../../errors/UnauthorizedError.js";
import {
  create,
  findActiveByProfessionalAndWeekday,
  findActiveByProfessionalAndWeekdayIgnoringId,
  findById,
  findProfessionalById,
  findProfessionalByUserId,
  list,
  softDelete,
  update,
  updateStatus,
} from "./professionalSchedule.repository.js";

const NOT_FOUND_MESSAGE = "Horário do profissional não encontrado.";
const ACCESS_DENIED_MESSAGE = "Acesso negado.";
const DUPLICATE_MESSAGE =
  "Já existe um horário ativo para este profissional neste dia da semana.";


async function ensureProfessionalValid(professionalId) {
  const professional = await findProfessionalById(professionalId);

  if (!professional || professional.status !== USER_STATUS.ACTIVE) {
    throw new BadRequestError("Profissional não encontrado ou inativo.");
  }

  return professional;
}

async function ensureScheduleExists(id) {
  const schedule = await findById(id);

  if (!schedule) {
    throw new NotFoundError(NOT_FOUND_MESSAGE);
  }

  return schedule;
}

async function ensureNoDuplicateActiveSchedule(
  professionalId,
  weekday,
  isActive,
  ignoringId,
) {
  if (!isActive) return;

  const existing = ignoringId
    ? await findActiveByProfessionalAndWeekdayIgnoringId(professionalId, weekday, ignoringId)
    : await findActiveByProfessionalAndWeekday(professionalId, weekday);

  if (existing) {
    throw new ConflictError(DUPLICATE_MESSAGE);
  }
}

async function ensureProfessionalOwnership(userId, professionalId) {
  const ownProfessional = await findProfessionalByUserId(userId);

  if (!ownProfessional || ownProfessional.id !== professionalId) {
    throw new ForbiddenError(ACCESS_DENIED_MESSAGE);
  }
}

async function ensureViewAccess(actor, schedule) {
  if (actor.role === ROLES.ADMIN) return;

  if (actor.role === ROLES.PROFESSIONAL) {
    await ensureProfessionalOwnership(actor.id, schedule.professionalId);
    return;
  }

  if (actor.role === ROLES.CLIENT) {
    if (!schedule.isActive) {
      throw new ForbiddenError(ACCESS_DENIED_MESSAGE);
    }

    return;
  }

  throw new ForbiddenError(ACCESS_DENIED_MESSAGE);
}

async function buildListFilters(query, actor) {
  const filters = { ...query };

  if (actor.role === ROLES.ADMIN) {
    return filters;
  }

  if (actor.role === ROLES.PROFESSIONAL) {
    const ownProfessional = await findProfessionalByUserId(actor.id);
    filters.professionalId = ownProfessional?.id ?? "none";
    return filters;
  }

  if (actor.role === ROLES.CLIENT) {
    filters.isActive = true;
    return filters;
  }

  throw new ForbiddenError(ACCESS_DENIED_MESSAGE);
}

export async function createProfessionalSchedule(payload) {
  await ensureProfessionalValid(payload.professionalId);
  await ensureNoDuplicateActiveSchedule(
    payload.professionalId,
    payload.weekday,
    payload.isActive,
  );

  return create({
    professionalId: payload.professionalId,
    weekday: payload.weekday,
    openTime: payload.openTime,
    closeTime: payload.closeTime,
    isActive: payload.isActive,
  });
}

export async function listProfessionalSchedules(query, actor) {
  const filters = await buildListFilters(query, actor);
  return list(filters);
}

export async function getProfessionalScheduleById(id, actor) {
  const schedule = await ensureScheduleExists(id);
  await ensureViewAccess(actor, schedule);
  return schedule;
}

export async function updateProfessionalSchedule(id, payload) {
  const schedule = await ensureScheduleExists(id);

  await ensureNoDuplicateActiveSchedule(
    schedule.professionalId,
    payload.weekday,
    payload.isActive,
    id,
  );

  return update(id, {
    weekday: payload.weekday,
    openTime: payload.openTime,
    closeTime: payload.closeTime,
    isActive: payload.isActive,
  });
}

export async function updateProfessionalScheduleStatus(id, payload) {
  const schedule = await ensureScheduleExists(id);

  await ensureNoDuplicateActiveSchedule(
    schedule.professionalId,
    schedule.weekday,
    payload.isActive,
    id,
  );

  return updateStatus(id, payload.isActive);
}

export async function deleteProfessionalSchedule(id) {
  await ensureScheduleExists(id);
  await softDelete(id);
}
