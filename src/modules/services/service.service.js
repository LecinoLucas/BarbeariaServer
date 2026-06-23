import { ROLES } from "../../constants/roles.js";
import { SERVICE_STATUS } from "../../constants/serviceStatus.js";
import { BadRequestError } from "../../errors/BadRequestError.js";
import { ConflictError } from "../../errors/ConflictError.js";
import { ForbiddenError } from "../../errors/ForbiddenError.js";
import { NotFoundError } from "../../errors/NotFoundError.js";
import { UnauthorizedError } from "../../errors/UnauthorizedError.js";
import {
  count,
  create,
  findById,
  findByName,
  findByNameIgnoringId,
  list,
  softDelete,
  update,
} from "./service.repository.js";

const NOT_FOUND_MESSAGE = "Serviço não encontrado.";
const DUPLICATE_NAME_MESSAGE = "Já existe um serviço não deletado com este nome.";


function buildDeletedName(service) {
  return `${service.id}.deleted.${Date.now()}.${service.name}`;
}

async function ensureNameAvailable(name, ignoringId) {
  const existing = ignoringId
    ? await findByNameIgnoringId(name, ignoringId)
    : await findByName(name);

  if (existing) throw new ConflictError(DUPLICATE_NAME_MESSAGE);
}

async function ensureServiceExists(id) {
  const service = await findById(id);
  if (!service) throw new NotFoundError(NOT_FOUND_MESSAGE);
  return service;
}

function buildListFilters(query, actor) {
  if (actor.role === ROLES.CLIENT) {
    return { ...query, status: SERVICE_STATUS.ACTIVE };
  }
  return { ...query };
}

function ensureViewAccess(actor, service) {
  if (actor.role === ROLES.CLIENT && service.status !== SERVICE_STATUS.ACTIVE) {
    throw new NotFoundError(NOT_FOUND_MESSAGE);
  }
}

export async function createService(payload) {
  await ensureNameAvailable(payload.name);

  return create({
    name: payload.name,
    description: payload.description ?? null,
    price: payload.price,
    durationMinutes: payload.durationMinutes,
    status: payload.status ?? SERVICE_STATUS.ACTIVE,
  });
}

export async function listServices(query, actor) {
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

export async function getServiceById(id, actor) {
  const service = await ensureServiceExists(id);
  ensureViewAccess(actor, service);
  return service;
}

export async function updateService(id, payload) {
  await ensureServiceExists(id);
  await ensureNameAvailable(payload.name, id);

  return update(id, {
    name: payload.name,
    description: payload.description ?? null,
    price: payload.price,
    durationMinutes: payload.durationMinutes,
    status: payload.status,
  });
}

export async function updateServiceStatus(id, payload) {
  await ensureServiceExists(id);
  return update(id, { status: payload.status });
}

export async function deleteService(id) {
  const service = await ensureServiceExists(id);
  await softDelete(id, buildDeletedName(service));
}
