import { Prisma } from "@prisma/client";

import { ROLES } from "../../constants/roles.js";
import { USER_STATUS } from "../../constants/userStatus.js";
import { hashPassword } from "../../utils/hash.js";
import { BadRequestError } from "../../errors/BadRequestError.js";
import { ConflictError } from "../../errors/ConflictError.js";
import { ForbiddenError } from "../../errors/ForbiddenError.js";
import { NotFoundError } from "../../errors/NotFoundError.js";
import { UnauthorizedError } from "../../errors/UnauthorizedError.js";
import {
  count,
  countActiveAdmins,
  create,
  findByEmail,
  findByEmailIgnoringId,
  findById,
  list,
  softDelete,
  update,
} from "./user.repository.js";

const NOT_FOUND_MESSAGE = "Usuário não encontrado.";
const DUPLICATE_EMAIL_MESSAGE = "Já existe um usuário ativo com este email.";
const LAST_ADMIN_MESSAGE = "Não é possível remover ou inativar o último ADMIN ativo.";


function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

async function ensureUserExists(id) {
  const user = await findById(id);

  if (!user) {
    throw new NotFoundError(NOT_FOUND_MESSAGE);
  }

  return user;
}

async function ensureEmailAvailable(email, ignoringId) {
  const normalizedEmail = normalizeEmail(email);
  const existingUser = ignoringId
    ? await findByEmailIgnoringId(normalizedEmail, ignoringId)
    : await findByEmail(normalizedEmail);

  if (existingUser) {
    throw new ConflictError(DUPLICATE_EMAIL_MESSAGE);
  }

  return normalizedEmail;
}

function isActiveAdmin(user) {
  return user.role === ROLES.ADMIN && user.status === USER_STATUS.ACTIVE;
}

async function ensureLastActiveAdminWillRemain(currentUser, nextRole, nextStatus) {
  const willRemainActiveAdmin =
    nextRole === ROLES.ADMIN && nextStatus === USER_STATUS.ACTIVE;

  if (!isActiveAdmin(currentUser) || willRemainActiveAdmin) {
    return;
  }

  const activeAdmins = await countActiveAdmins();

  if (activeAdmins <= 1) {
    throw new BadRequestError(LAST_ADMIN_MESSAGE);
  }
}

function buildDeletedEmail(user) {
  return `${user.id}.deleted.${Date.now()}.${user.email}`;
}

function isUniqueConstraintError(error) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function createUser(payload) {
  const normalizedEmail = await ensureEmailAvailable(payload.email);
  const passwordHash = await hashPassword(payload.password);

  try {
    return await create({
      name: payload.name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: payload.role,
      status: payload.status,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ConflictError(DUPLICATE_EMAIL_MESSAGE);
    }

    throw error;
  }
}

export async function listUsers(filters) {
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

export function getUserById(id) {
  return ensureUserExists(id);
}

export async function updateUser(id, payload) {
  const currentUser = await ensureUserExists(id);
  const normalizedEmail = await ensureEmailAvailable(payload.email, id);

  await ensureLastActiveAdminWillRemain(currentUser, payload.role, payload.status);

  try {
    return await update(id, {
      name: payload.name.trim(),
      email: normalizedEmail,
      role: payload.role,
      status: payload.status,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ConflictError(DUPLICATE_EMAIL_MESSAGE);
    }

    throw error;
  }
}

export async function updateUserPassword(id, payload) {
  await ensureUserExists(id);
  const passwordHash = await hashPassword(payload.password);

  await update(id, { passwordHash });
}

export async function updateUserStatus(id, payload) {
  const currentUser = await ensureUserExists(id);

  await ensureLastActiveAdminWillRemain(currentUser, currentUser.role, payload.status);

  return update(id, {
    status: payload.status,
  });
}

export async function deleteUser(id) {
  const currentUser = await ensureUserExists(id);

  await ensureLastActiveAdminWillRemain(currentUser, currentUser.role, USER_STATUS.INACTIVE);

  await softDelete(id, buildDeletedEmail(currentUser));
}
