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
  findClientAuthUserByGoogleId,
  findClientAuthUserById,
  findClientAuthSignupCandidateByEmail,
  findClientAuthSignupCandidateByPhone,
  createClientAuthSignup,
  updateClientAuthLastLoginAt,
  updateClientAuthGoogleId,
  updateClientAuthPasswordHash,
} from "./clientAuth.repository.js";
import { getClientPortalSettings } from "../settings/settings.service.js";
import { verifyGoogleIdToken } from "../../providers/google/googleAuthProvider.js";

const INVALID_CREDENTIALS_MESSAGE = "Credenciais inválidas.";
const UNAUTHORIZED_MESSAGE = "Não autorizado.";
const CLIENT_ACCESS_DENIED_MESSAGE = "Acesso restrito ao portal do cliente.";
const CLIENT_PROFILE_REQUIRED_MESSAGE =
  "Usuário sem vínculo ativo com perfil de cliente.";
const SAME_PASSWORD_MESSAGE = "A nova senha deve ser diferente da senha atual.";
const SELF_SIGNUP_DISABLED_MESSAGE =
  "O cadastro online está temporariamente indisponível. Fale com a barbearia.";
const DUPLICATE_EMAIL_MESSAGE = "Já existe um acesso cadastrado com este e-mail.";
const EXISTING_CLIENT_ACCESS_MESSAGE =
  "Encontramos um cadastro existente com esses dados. Fale com a barbearia para liberar o acesso.";
const APPROVAL_REQUIRED_MESSAGE = "Cadastro recebido. Aguarde aprovação da barbearia.";
const GOOGLE_LOGIN_DISABLED_MESSAGE =
  "Login com Google indisponível no momento.";
const GOOGLE_LOCAL_PASSWORD_REQUIRED_MESSAGE =
  "Sua conta foi criada com Google e não possui senha local.";
const GOOGLE_ACCOUNT_ALREADY_LINKED_MESSAGE =
  "Este e-mail já está vinculado a outra conta Google.";

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

function normalizeSignupPhone(phone) {
  return phone.trim();
}

function normalizeSignupName(name) {
  return name.trim();
}

function normalizeSignupEmail(email) {
  return email.trim().toLowerCase();
}

function resolveExistingSignupClient(clientByEmail, clientByPhone) {
  if (!clientByEmail && !clientByPhone) {
    return null;
  }

  if (clientByEmail && clientByPhone && clientByEmail.id !== clientByPhone.id) {
    throw new BadRequestError(EXISTING_CLIENT_ACCESS_MESSAGE);
  }

  return clientByEmail ?? clientByPhone;
}

function ensureSignupClientCanBeLinked(client, normalizedEmail, normalizedPhone) {
  if (!client) {
    return;
  }

  if (client.userId || client.deletedAt || client.status !== USER_STATUS.ACTIVE) {
    throw new BadRequestError(EXISTING_CLIENT_ACCESS_MESSAGE);
  }

  if (client.email !== normalizedEmail || client.phone !== normalizedPhone) {
    throw new BadRequestError(EXISTING_CLIENT_ACCESS_MESSAGE);
  }
}

export function createClientAuthService(deps = {}) {
  const repository = {
    findClientAuthUserByEmail,
    findClientAuthUserByGoogleId,
    findClientAuthUserById,
    findClientAuthSignupCandidateByEmail,
    findClientAuthSignupCandidateByPhone,
    createClientAuthSignup,
    updateClientAuthLastLoginAt,
    updateClientAuthGoogleId,
    updateClientAuthPasswordHash,
    ...deps,
  };
  const getClientPortalSettingsConfig =
    deps.getClientPortalSettings ?? getClientPortalSettings;
  const verifyGoogleCredential = deps.verifyGoogleIdToken ?? verifyGoogleIdToken;

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

      if (!user.passwordHash) {
        throw new BadRequestError(GOOGLE_LOCAL_PASSWORD_REQUIRED_MESSAGE);
      }

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

    async signup({ confirmPassword: _confirmPassword, ...payload }) {
      const config = await getClientPortalSettingsConfig();

      if (!config.enabled || !config.selfSignupEnabled) {
        throw new ForbiddenError(SELF_SIGNUP_DISABLED_MESSAGE);
      }

      const normalizedEmail = normalizeSignupEmail(payload.email);
      const normalizedPhone = normalizeSignupPhone(payload.phone);
      const normalizedName = normalizeSignupName(payload.name);

      const existingUser = await repository.findClientAuthUserByEmail(normalizedEmail);

      if (existingUser && !existingUser.deletedAt) {
        throw new BadRequestError(DUPLICATE_EMAIL_MESSAGE);
      }

      const [clientByEmail, clientByPhone] = await Promise.all([
        repository.findClientAuthSignupCandidateByEmail(normalizedEmail),
        repository.findClientAuthSignupCandidateByPhone(normalizedPhone),
      ]);
      const existingClient = resolveExistingSignupClient(clientByEmail, clientByPhone);

      ensureSignupClientCanBeLinked(existingClient, normalizedEmail, normalizedPhone);

      const requiresApproval = config.requireAdminApproval === true;
      const userStatus = requiresApproval ? USER_STATUS.INACTIVE : USER_STATUS.ACTIVE;
      const passwordHash = await hashPassword(payload.password);
      const created = await repository.createClientAuthSignup({
        existingClientId: existingClient?.id ?? null,
        userData: {
          name: normalizedName,
          email: normalizedEmail,
          passwordHash,
          role: ROLES.CLIENT,
          status: userStatus,
          lastLoginAt: requiresApproval ? null : new Date(),
        },
        clientData: {
          name: normalizedName,
          phone: normalizedPhone,
          email: normalizedEmail,
          status: existingClient?.status ?? USER_STATUS.ACTIVE,
        },
      });

      if (requiresApproval) {
        return {
          requiresAdminApproval: true,
          message: APPROVAL_REQUIRED_MESSAGE,
        };
      }

      return {
        requiresAdminApproval: false,
        ...buildAuthPayload(created.user, created.client),
      };
    },

    async loginWithGoogle({ credential }) {
      const config = await getClientPortalSettingsConfig();

      if (!config.enabled || !config.googleLoginEnabled) {
        throw new ForbiddenError(GOOGLE_LOGIN_DISABLED_MESSAGE);
      }

      const googleAccount = await verifyGoogleCredential(credential);
      const existingGoogleUser = await repository.findClientAuthUserByGoogleId(
        googleAccount.googleId,
      );

      if (existingGoogleUser) {
        const client = ensureClientSession(existingGoogleUser);
        await repository.updateClientAuthLastLoginAt(existingGoogleUser.id);

        return {
          requiresAdminApproval: false,
          ...buildAuthPayload(existingGoogleUser, client),
        };
      }

      const userByEmail = await repository.findClientAuthUserByEmail(googleAccount.email);

      if (userByEmail) {
        ensureUserActive(userByEmail);
        ensureClientRole(userByEmail);

        if (userByEmail.googleId && userByEmail.googleId !== googleAccount.googleId) {
          throw new ForbiddenError(GOOGLE_ACCOUNT_ALREADY_LINKED_MESSAGE);
        }

        const linkedUser = userByEmail.googleId
          ? userByEmail
          : await repository.updateClientAuthGoogleId(userByEmail.id, googleAccount.googleId);

        const client = ensureLinkedActiveClient(linkedUser);
        await repository.updateClientAuthLastLoginAt(linkedUser.id);

        return {
          requiresAdminApproval: false,
          ...buildAuthPayload(linkedUser, client),
        };
      }

      if (!config.selfSignupEnabled) {
        throw new ForbiddenError(SELF_SIGNUP_DISABLED_MESSAGE);
      }

      const requiresApproval = config.requireAdminApproval === true;
      const userStatus = requiresApproval ? USER_STATUS.INACTIVE : USER_STATUS.ACTIVE;
      const created = await repository.createClientAuthSignup({
        existingClientId: null,
        userData: {
          name: googleAccount.name,
          email: googleAccount.email,
          passwordHash: null,
          googleId: googleAccount.googleId,
          role: ROLES.CLIENT,
          status: userStatus,
          lastLoginAt: requiresApproval ? null : new Date(),
        },
        clientData: {
          name: googleAccount.name,
          phone: null,
          email: googleAccount.email,
          status: USER_STATUS.ACTIVE,
        },
      });

      if (requiresApproval) {
        return {
          requiresAdminApproval: true,
          message: APPROVAL_REQUIRED_MESSAGE,
        };
      }

      return {
        requiresAdminApproval: false,
        ...buildAuthPayload(created.user, created.client),
      };
    },
  };
}

const defaultService = createClientAuthService();

export const login = defaultService.login;
export const refresh = defaultService.refresh;
export const me = defaultService.me;
export const changePassword = defaultService.changePassword;
export const signup = defaultService.signup;
export const loginWithGoogle = defaultService.loginWithGoogle;
