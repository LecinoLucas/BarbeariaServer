import { Prisma } from "@prisma/client";

import { ROLES } from "../../constants/roles.js";
import { USER_STATUS } from "../../constants/userStatus.js";
import { ConflictError } from "../../errors/ConflictError.js";
import { ForbiddenError } from "../../errors/ForbiddenError.js";
import { NotFoundError } from "../../errors/NotFoundError.js";
import { hashPassword } from "../../utils/hash.js";
import { findByEmail as findUserByEmail } from "../users/user.repository.js";
import {
  count,
  create,
  createPortalAccessForClient,
  findByEmail,
  findByEmailIgnoringId,
  findById,
  findByPhone,
  findByPhoneIgnoringId,
  findByUserId,
  findPortalAccessUserById,
  list,
  listBirthdaysByMonth,
  listPortalAccessUsersByIds,
  listTopActiveClients,
  softDelete,
  update,
  updatePortalAccessPassword,
  updatePortalAccessStatus,
} from "./client.repository.js";

const NOT_FOUND_MESSAGE = "Cliente não encontrado.";
const ACCESS_DENIED_MESSAGE = "Acesso negado.";
const DUPLICATE_PHONE_MESSAGE = "Já existe um cliente não deletado com este telefone.";
const DUPLICATE_EMAIL_MESSAGE = "Já existe um cliente não deletado com este email.";
const DUPLICATE_USER_EMAIL_MESSAGE = "Já existe um usuário ativo com este email.";
const PORTAL_ACCESS_ALREADY_EXISTS_MESSAGE = "Este cliente já possui acesso ao portal.";
const PORTAL_ACCESS_REQUIRED_MESSAGE = "Este cliente ainda não possui acesso ao portal.";
const PORTAL_ACCESS_INACTIVE_CLIENT_MESSAGE =
  "Somente clientes ativos podem receber acesso ao portal.";

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

function buildPortalAccess(client, usersById) {
  if (!client?.userId) {
    return {
      enabled: false,
      userId: null,
      email: null,
      status: null,
    };
  }

  const user = usersById.get(client.userId);

  if (!user || user.role !== ROLES.CLIENT) {
    return {
      enabled: false,
      userId: client.userId,
      email: null,
      status: null,
    };
  }

  return {
    enabled: true,
    userId: user.id,
    email: user.email,
    status: user.status,
  };
}

async function attachPortalAccess(items, deps) {
  const listItems = Array.isArray(items) ? items : [items];
  const userIds = [...new Set(listItems.map((item) => item?.userId).filter(Boolean))];
  const users = await deps.listPortalAccessUsersByIds(userIds);
  const usersById = new Map(users.map((user) => [user.id, user]));

  const normalized = listItems.map((item) => ({
    ...item,
    portalAccess: buildPortalAccess(item, usersById),
  }));

  return Array.isArray(items) ? normalized : normalized[0];
}

export function createClientService(deps = {}) {
  const repository = {
    count,
    create,
    createPortalAccessForClient,
    findByEmail,
    findByEmailIgnoringId,
    findById,
    findByPhone,
    findByPhoneIgnoringId,
    findByUserId,
    findPortalAccessUserById,
    list,
    listBirthdaysByMonth,
    listPortalAccessUsersByIds,
    listTopActiveClients,
    softDelete,
    update,
    updatePortalAccessPassword,
    updatePortalAccessStatus,
    ...deps,
  };

  const passwordHasher = deps.hashPassword ?? hashPassword;
  const lookupUserByEmail = deps.findUserByEmail ?? findUserByEmail;

  async function ensurePhoneAvailable(phone, ignoringId) {
    const normalizedPhone = normalizePhone(phone);
    const existingClient = ignoringId
      ? await repository.findByPhoneIgnoringId(normalizedPhone, ignoringId)
      : await repository.findByPhone(normalizedPhone);

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
      ? await repository.findByEmailIgnoringId(normalizedEmail, ignoringId)
      : await repository.findByEmail(normalizedEmail);

    if (existingClient) {
      throw new ConflictError(DUPLICATE_EMAIL_MESSAGE);
    }

    return normalizedEmail;
  }

  async function ensureClientExists(id) {
    const client = await repository.findById(id);

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

    const ownClient = await repository.findByUserId(actor.id);

    if (!ownClient || ownClient.id !== client.id) {
      throw new ForbiddenError(ACCESS_DENIED_MESSAGE);
    }
  }

  async function ensurePortalAccessEligible(clientId) {
    const client = await ensureClientExists(clientId);

    if (client.status !== USER_STATUS.ACTIVE) {
      throw new ConflictError(PORTAL_ACCESS_INACTIVE_CLIENT_MESSAGE);
    }

    if (client.userId) {
      throw new ConflictError(PORTAL_ACCESS_ALREADY_EXISTS_MESSAGE);
    }

    return client;
  }

  async function ensurePortalAccessUser(clientId) {
    const client = await ensureClientExists(clientId);

    if (!client.userId) {
      throw new ConflictError(PORTAL_ACCESS_REQUIRED_MESSAGE);
    }

    const user = await repository.findPortalAccessUserById(client.userId);

    if (!user || user.role !== ROLES.CLIENT) {
      throw new ConflictError(PORTAL_ACCESS_REQUIRED_MESSAGE);
    }

    return { client, user };
  }

  return {
    async createClient(payload) {
      const phone = await ensurePhoneAvailable(payload.phone);
      const email = await ensureEmailAvailable(payload.email);
      const client = await repository.create({
        name: payload.name.trim(),
        phone,
        email,
        birthDate: payload.birthDate,
        notes: payload.notes,
        status: payload.status ?? USER_STATUS.ACTIVE,
      });

      return attachPortalAccess(client, repository);
    },

    async listClients(filters) {
      const [items, total] = await Promise.all([
        repository.list(filters),
        repository.count(filters),
      ]);
      const normalizedItems = await attachPortalAccess(items, repository);

      return {
        items: normalizedItems,
        meta: {
          page: filters.page,
          limit: filters.limit,
          total,
          totalPages: total === 0 ? 0 : Math.ceil(total / filters.limit),
        },
      };
    },

    async getClientById(id, actor) {
      const client = await ensureClientExists(id);

      await ensureClientAccess(actor, client);

      return attachPortalAccess(client, repository);
    },

    async updateClient(id, payload, actor) {
      const currentClient = await ensureClientExists(id);

      await ensureClientAccess(actor, currentClient);

      const phone = await ensurePhoneAvailable(payload.phone, id);
      const email = await ensureEmailAvailable(payload.email, id);
      const client = await repository.update(id, {
        name: payload.name.trim(),
        phone,
        email,
        birthDate: payload.birthDate,
        notes: payload.notes,
        status: payload.status,
      });

      return attachPortalAccess(client, repository);
    },

    async updateClientStatus(id, payload) {
      await ensureClientExists(id);
      const client = await repository.update(id, {
        status: payload.status,
      });

      return attachPortalAccess(client, repository);
    },

    async deleteClient(id) {
      const client = await ensureClientExists(id);

      await repository.softDelete(id, buildDeletedPhone(client), buildDeletedEmail(client));
    },

    getClientBirthdays(month) {
      return repository.listBirthdaysByMonth(month);
    },

    async getTopActiveClients(limit) {
      const items = await repository.listTopActiveClients(limit);
      return items ?? [];
    },

    async createClientPortalAccess(clientId, payload) {
      const client = await ensurePortalAccessEligible(clientId);
      const normalizedEmail = normalizeEmail(payload.email);
      const existingUser = await lookupUserByEmail(normalizedEmail);

      if (existingUser) {
        throw new ConflictError(DUPLICATE_USER_EMAIL_MESSAGE);
      }

      const passwordHash = await passwordHasher(payload.password);
      let result;

      try {
        result = await repository.createPortalAccessForClient(client.id, {
          name: client.name,
          email: normalizedEmail,
          passwordHash,
          role: ROLES.CLIENT,
          status: USER_STATUS.ACTIVE,
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          throw new ConflictError(DUPLICATE_USER_EMAIL_MESSAGE);
        }

        throw error;
      }

      return {
        ...(await attachPortalAccess(result.client, repository)),
      };
    },

    async resetClientPortalPassword(clientId, payload) {
      const { client, user } = await ensurePortalAccessUser(clientId);
      const passwordHash = await passwordHasher(payload.password);

      await repository.updatePortalAccessPassword(user.id, passwordHash);

      return attachPortalAccess(client, repository);
    },

    async updateClientPortalAccessStatus(clientId, payload) {
      const { client, user } = await ensurePortalAccessUser(clientId);

      await repository.updatePortalAccessStatus(user.id, payload.status);

      return attachPortalAccess(client, repository);
    },
  };
}

const defaultService = createClientService();

export const createClient = defaultService.createClient;
export const listClients = defaultService.listClients;
export const getClientById = defaultService.getClientById;
export const updateClient = defaultService.updateClient;
export const updateClientStatus = defaultService.updateClientStatus;
export const deleteClient = defaultService.deleteClient;
export const getClientBirthdays = defaultService.getClientBirthdays;
export const getTopActiveClients = defaultService.getTopActiveClients;
export const createClientPortalAccess = defaultService.createClientPortalAccess;
export const resetClientPortalPassword = defaultService.resetClientPortalPassword;
export const updateClientPortalAccessStatus = defaultService.updateClientPortalAccessStatus;
