import { ROLES } from "../../constants/roles.js";
import { USER_STATUS } from "../../constants/userStatus.js";
import { BadRequestError } from "../../errors/BadRequestError.js";
import { ForbiddenError } from "../../errors/ForbiddenError.js";
import { UnauthorizedError } from "../../errors/UnauthorizedError.js";
import { comparePassword, hashPassword } from "../../utils/hash.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../../utils/jwt.js";
import {
  findClientAuthUserByEmail,
  findClientAuthUserById,
  updateClientAuthLastLoginAt,
  updateClientAuthPasswordHash,
} from "./clientAuth.repository.js";

const INVALID_CREDENTIALS_MESSAGE = "Credenciais inválidas.";
const UNAUTHORIZED_MESSAGE = "Não autorizado.";
const CLIENT_ACCESS_DENIED_MESSAGE = "Acesso restrito ao portal do cliente.";
const CLIENT_PROFILE_REQUIRED_MESSAGE =
  "Usuário sem vínculo ativo com perfil de cliente.";
const SAME_PASSWORD_MESSAGE = "A nova senha deve ser diferente da senha atual.";

function getTokenSubject(payload) {
  if (!payload || typeof payload !== "object" || typeof payload.sub !== "string") {
    throw new UnauthorizedError(UNAUTHORIZED_MESSAGE);
  }

  return payload.sub;
}

function toSafeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
  };
}

function toSafeClient(client) {
  return {
    id: client.id,
    name: client.name,
    phone: client.phone,
    email: client.email,
    birthDate: client.birthDate,
    status: client.status,
  };
}

function buildAuthPayload(user, client) {
  const safeUser = toSafeUser(user);
  const safeClient = toSafeClient(client);

  return {
    accessToken: generateAccessToken(safeUser),
    refreshToken: generateRefreshToken(safeUser),
    user: safeUser,
    client: safeClient,
  };
}

function ensureClientRole(user) {
  if (user.role !== ROLES.CLIENT) {
    throw new ForbiddenError(CLIENT_ACCESS_DENIED_MESSAGE);
  }
}

function ensureUserActive(user) {
  if (user.status === USER_STATUS.INACTIVE) {
    throw new ForbiddenError("Usuário inativo.");
  }
}

function ensureLinkedActiveClient(user) {
  const client = user.client;

  if (!client || client.deletedAt || client.status !== USER_STATUS.ACTIVE) {
    throw new ForbiddenError(CLIENT_PROFILE_REQUIRED_MESSAGE);
  }

  return client;
}

function ensureClientSession(user) {
  if (!user || user.deletedAt) {
    throw new UnauthorizedError(UNAUTHORIZED_MESSAGE);
  }

  ensureUserActive(user);
  ensureClientRole(user);

  return ensureLinkedActiveClient(user);
}

export function createClientAuthService(deps = {}) {
  const repository = {
    findClientAuthUserByEmail,
    findClientAuthUserById,
    updateClientAuthLastLoginAt,
    updateClientAuthPasswordHash,
    ...deps,
  };

  return {
    async login({ email, password }) {
      const normalizedEmail = email.trim().toLowerCase();
      const user = await repository.findClientAuthUserByEmail(normalizedEmail);

      if (!user || user.deletedAt) {
        throw new UnauthorizedError(INVALID_CREDENTIALS_MESSAGE);
      }

      ensureUserActive(user);
      ensureClientRole(user);

      const passwordMatches = await comparePassword(password, user.passwordHash);

      if (!passwordMatches) {
        throw new UnauthorizedError(INVALID_CREDENTIALS_MESSAGE);
      }

      const client = ensureLinkedActiveClient(user);

      await repository.updateClientAuthLastLoginAt(user.id);

      return buildAuthPayload(user, client);
    },

    async refresh(refreshToken) {
      if (!refreshToken) {
        throw new UnauthorizedError(UNAUTHORIZED_MESSAGE);
      }

      let payload;

      try {
        payload = verifyRefreshToken(refreshToken);
      } catch {
        throw new UnauthorizedError(UNAUTHORIZED_MESSAGE);
      }

      const user = await repository.findClientAuthUserById(getTokenSubject(payload));
      const client = ensureClientSession(user);

      return {
        accessToken: generateAccessToken(toSafeUser(user)),
        user: toSafeUser(user),
        client: toSafeClient(client),
      };
    },

    async me(userId) {
      const user = await repository.findClientAuthUserById(userId);
      const client = ensureClientSession(user);

      return {
        user: toSafeUser(user),
        client: toSafeClient(client),
      };
    },

    async changePassword(userId, { currentPassword, newPassword }) {
      const user = await repository.findClientAuthUserById(userId);

      ensureClientSession(user);

      const passwordMatches = await comparePassword(currentPassword, user.passwordHash);

      if (!passwordMatches) {
        throw new UnauthorizedError("Senha atual inválida.");
      }

      const samePassword = await comparePassword(newPassword, user.passwordHash);

      if (samePassword) {
        throw new BadRequestError(SAME_PASSWORD_MESSAGE);
      }

      const nextPasswordHash = await hashPassword(newPassword);

      await repository.updateClientAuthPasswordHash(user.id, nextPasswordHash);
    },
  };
}

const defaultService = createClientAuthService();

export const login = defaultService.login;
export const refresh = defaultService.refresh;
export const me = defaultService.me;
export const changePassword = defaultService.changePassword;
