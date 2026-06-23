import { ROLES } from "../../constants/roles.js";
import { USER_STATUS } from "../../constants/userStatus.js";
import { BadRequestError } from "../../errors/BadRequestError.js";
import { ConflictError } from "../../errors/ConflictError.js";
import { ForbiddenError } from "../../errors/ForbiddenError.js";
import { NotFoundError } from "../../errors/NotFoundError.js";
import { UnauthorizedError } from "../../errors/UnauthorizedError.js";
import {
  count,
  create,
  findById,
  findByPhone,
  findByPhoneIgnoringId,
  findByUserId,
  findLinkedProfessionalByUserId,
  findLinkedProfessionalByUserIdIgnoringId,
  findUserById,
  list,
  softDelete,
  update,
} from "./professional.repository.js";

const NOT_FOUND_MESSAGE = "Profissional não encontrado.";
const ACCESS_DENIED_MESSAGE = "Acesso negado.";
const DUPLICATE_PHONE_MESSAGE = "Já existe um profissional não deletado com este telefone.";
const USER_NOT_FOUND_MESSAGE = "Usuário não encontrado ou inativo.";
const USER_NOT_PROFESSIONAL_MESSAGE = "Usuário não possui perfil PROFESSIONAL.";
const USER_ALREADY_LINKED_MESSAGE = "Usuário já está vinculado a outro profissional.";


function buildDeletedPhone(professional) {
  if (!professional.phone) return null;
  return `${professional.id}.deleted.${Date.now()}.${professional.phone}`;
}

async function ensurePhoneAvailable(phone, ignoringId) {
  if (!phone) return null;

  const existing = ignoringId
    ? await findByPhoneIgnoringId(phone, ignoringId)
    : await findByPhone(phone);

  if (existing) {
    throw new ConflictError(DUPLICATE_PHONE_MESSAGE);
  }

  return phone;
}

async function ensureUserValid(userId, ignoringProfessionalId) {
  const user = await findUserById(userId);

  if (!user || user.status === USER_STATUS.INACTIVE) {
    throw new BadRequestError(USER_NOT_FOUND_MESSAGE);
  }

  if (user.role !== ROLES.PROFESSIONAL) {
    throw new BadRequestError(USER_NOT_PROFESSIONAL_MESSAGE);
  }

  const linked = ignoringProfessionalId
    ? await findLinkedProfessionalByUserIdIgnoringId(userId, ignoringProfessionalId)
    : await findLinkedProfessionalByUserId(userId);

  if (linked) {
    throw new ConflictError(USER_ALREADY_LINKED_MESSAGE);
  }
}

async function ensureProfessionalExists(id) {
  const professional = await findById(id);

  if (!professional) {
    throw new NotFoundError(NOT_FOUND_MESSAGE);
  }

  return professional;
}

function ensureEditAccess(actor, professional) {
  if (actor.role === ROLES.ADMIN) return;

  if (actor.role === ROLES.PROFESSIONAL) {
    if (!professional.userId || professional.userId !== actor.id) {
      throw new ForbiddenError(ACCESS_DENIED_MESSAGE);
    }

    return;
  }

  throw new ForbiddenError(ACCESS_DENIED_MESSAGE);
}

function ensureViewAccess(actor, professional) {
  if (actor.role === ROLES.ADMIN) return;

  if (professional.status !== USER_STATUS.ACTIVE) {
    throw new ForbiddenError(ACCESS_DENIED_MESSAGE);
  }
}

function buildListFilters(query, actor) {
  const filters = { ...query };

  if (actor.role === ROLES.CLIENT) {
    filters.status = USER_STATUS.ACTIVE;
  }

  return filters;
}

export async function createProfessional(payload) {
  const phone = await ensurePhoneAvailable(payload.phone);

  if (payload.userId) {
    await ensureUserValid(payload.userId);
  }

  return create({
    userId: payload.userId ?? null,
    name: payload.name.trim(),
    phone,
    specialty: payload.specialty ?? null,
    appointmentIntervalMinutes: payload.appointmentIntervalMinutes ?? null,
    status: payload.status ?? USER_STATUS.ACTIVE,
  });
}

export async function listProfessionals(query, actor) {
  const filters = buildListFilters(query, actor);
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

export async function getProfessionalById(id, actor) {
  const professional = await ensureProfessionalExists(id);

  ensureViewAccess(actor, professional);

  return professional;
}

export async function updateProfessional(id, payload, actor) {
  const current = await ensureProfessionalExists(id);

  ensureEditAccess(actor, current);

  const phone = await ensurePhoneAvailable(payload.phone, id);

  if (payload.userId) {
    await ensureUserValid(payload.userId, id);
  }

  return update(id, {
    userId: payload.userId ?? null,
    name: payload.name.trim(),
    phone,
    specialty: payload.specialty ?? null,
    appointmentIntervalMinutes: payload.appointmentIntervalMinutes ?? null,
    status: payload.status,
  });
}

export async function updateProfessionalStatus(id, payload) {
  await ensureProfessionalExists(id);

  return update(id, { status: payload.status });
}

export async function deleteProfessional(id) {
  const professional = await ensureProfessionalExists(id);

  await softDelete(id, buildDeletedPhone(professional));
}

export async function getMyProfessionalProfile(userId) {
  const professional = await findByUserId(userId);

  if (!professional) {
    throw new NotFoundError("Perfil profissional não encontrado.");
  }

  return professional;
}
