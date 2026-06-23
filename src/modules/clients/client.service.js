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
  findByEmail,
  findByEmailIgnoringId,
  findById,
  findByPhone,
  findByPhoneIgnoringId,
  findByUserId,
  list,
  listBirthdaysByMonth,
  listTopActiveClients,
  softDelete,
  update,
} from "./client.repository.js";

const NOT_FOUND_MESSAGE = "Cliente não encontrado.";
const ACCESS_DENIED_MESSAGE = "Acesso negado.";
const DUPLICATE_PHONE_MESSAGE = "Já existe um cliente não deletado com este telefone.";
const DUPLICATE_EMAIL_MESSAGE = "Já existe um cliente não deletado com este email.";


function normalizePhone(phone) {
  return phone.trim();
}

function normalizeEmail(email) {
  return email ? email.trim().toLowerCase() : null;
}

function buildDeletedPhone(client) {
  return `${client.id}.deleted.${Date.now()}.${client.phone}`;
}

function buildDeletedEmail(client) {
  if (!client.email) {
    return null;
  }

  return `${client.id}.deleted.${Date.now()}.${client.email}`;
}

async function ensurePhoneAvailable(phone, ignoringId) {
  const normalizedPhone = normalizePhone(phone);
  const existingClient = ignoringId
    ? await findByPhoneIgnoringId(normalizedPhone, ignoringId)
    : await findByPhone(normalizedPhone);

  if (existingClient) {
    throw new ConflictError(DUPLICATE_PHONE_MESSAGE);
  }

  return normalizedPhone;
}

async function ensureEmailAvailable(email, ignoringId) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return null;
  }

  const existingClient = ignoringId
    ? await findByEmailIgnoringId(normalizedEmail, ignoringId)
    : await findByEmail(normalizedEmail);

  if (existingClient) {
    throw new ConflictError(DUPLICATE_EMAIL_MESSAGE);
  }

  return normalizedEmail;
}

async function ensureClientExists(id) {
  const client = await findById(id);

  if (!client) {
    throw new NotFoundError(NOT_FOUND_MESSAGE);
  }

  return client;
}

async function ensureClientAccess(actor, client) {
  if (actor.role === ROLES.ADMIN || actor.role === ROLES.PROFESSIONAL) {
    return;
  }

  if (actor.role !== ROLES.CLIENT) {
    throw new ForbiddenError(ACCESS_DENIED_MESSAGE);
  }

  const ownClient = await findByUserId(actor.id);

  if (!ownClient || ownClient.id !== client.id) {
    throw new ForbiddenError(ACCESS_DENIED_MESSAGE);
  }
}

export async function createClient(payload) {
  const phone = await ensurePhoneAvailable(payload.phone);
  const email = await ensureEmailAvailable(payload.email);

  return create({
    name: payload.name.trim(),
    phone,
    email,
    birthDate: payload.birthDate,
    notes: payload.notes,
    status: payload.status ?? USER_STATUS.ACTIVE,
  });
}

export async function listClients(filters) {
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

export async function getClientById(id, actor) {
  const client = await ensureClientExists(id);

  await ensureClientAccess(actor, client);

  return client;
}

export async function updateClient(id, payload, actor) {
  const currentClient = await ensureClientExists(id);

  await ensureClientAccess(actor, currentClient);

  const phone = await ensurePhoneAvailable(payload.phone, id);
  const email = await ensureEmailAvailable(payload.email, id);

  return update(id, {
    name: payload.name.trim(),
    phone,
    email,
    birthDate: payload.birthDate,
    notes: payload.notes,
    status: payload.status,
  });
}

export async function updateClientStatus(id, payload) {
  await ensureClientExists(id);

  return update(id, {
    status: payload.status,
  });
}

export async function deleteClient(id) {
  const client = await ensureClientExists(id);

  await softDelete(id, buildDeletedPhone(client), buildDeletedEmail(client));
}

export function getClientBirthdays(month) {
  return listBirthdaysByMonth(month);
}

export async function getTopActiveClients(limit) {
  const items = await listTopActiveClients(limit);

  return items ?? [];
}
