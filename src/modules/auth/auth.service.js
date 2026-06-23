import { USER_STATUS } from "../../constants/userStatus.js";
import { comparePassword } from "../../utils/hash.js";
import { BadRequestError } from "../../errors/BadRequestError.js";
import { ConflictError } from "../../errors/ConflictError.js";
import { ForbiddenError } from "../../errors/ForbiddenError.js";
import { NotFoundError } from "../../errors/NotFoundError.js";
import { UnauthorizedError } from "../../errors/UnauthorizedError.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../../utils/jwt.js";
import {
  findSafeUserById,
  findUserByEmail,
  updateLastLoginAt,
} from "./auth.repository.js";

const INVALID_CREDENTIALS_MESSAGE = "Credenciais inválidas.";
const UNAUTHORIZED_MESSAGE = "Não autorizado.";


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

export async function login({ email, password }) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await findUserByEmail(normalizedEmail);

  if (!user || user.deletedAt) {
    throw new UnauthorizedError(INVALID_CREDENTIALS_MESSAGE);
  }

  if (user.status === USER_STATUS.INACTIVE) {
    throw new ForbiddenError("Usuário inativo.");
  }

  const passwordMatches = await comparePassword(password, user.passwordHash);

  if (!passwordMatches) {
    throw new UnauthorizedError(INVALID_CREDENTIALS_MESSAGE);
  }

  await updateLastLoginAt(user.id);

  const safeUser = toSafeUser(user);

  return {
    accessToken: generateAccessToken(safeUser),
    refreshToken: generateRefreshToken(safeUser),
    user: safeUser,
  };
}

export async function refresh(refreshToken) {
  if (!refreshToken) {
    throw new UnauthorizedError(UNAUTHORIZED_MESSAGE);
  }

  let payload;

  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new UnauthorizedError(UNAUTHORIZED_MESSAGE);
  }

  const user = await findSafeUserById(getTokenSubject(payload));

  if (!user || user.status === USER_STATUS.INACTIVE) {
    throw new UnauthorizedError(UNAUTHORIZED_MESSAGE);
  }

  return {
    accessToken: generateAccessToken(user),
    user,
  };
}
