import { USER_STATUS } from "../constants/userStatus.js";
import { errorResponse } from "../utils/response.js";
import { verifyAccessToken } from "../utils/jwt.js";
import { findSafeUserById } from "../modules/auth/auth.repository.js";

const UNAUTHORIZED_MESSAGE = "Não autorizado.";

function getTokenSubject(payload) {
  if (!payload || typeof payload !== "object" || typeof payload.sub !== "string") {
    throw new Error(UNAUTHORIZED_MESSAGE);
  }

  return payload.sub;
}

export async function authenticate(req, res, next) {
  const authorizationHeader = req.headers.authorization;

  if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
    return errorResponse(res, UNAUTHORIZED_MESSAGE, 401);
  }

  const token = authorizationHeader.slice(7).trim();

  if (!token) {
    return errorResponse(res, UNAUTHORIZED_MESSAGE, 401);
  }

  try {
    const payload = verifyAccessToken(token);
    const user = await findSafeUserById(getTokenSubject(payload));

    if (!user || user.status === USER_STATUS.INACTIVE) {
      return errorResponse(res, UNAUTHORIZED_MESSAGE, 401);
    }

    req.user = user;

    return next();
  } catch {
    return errorResponse(res, UNAUTHORIZED_MESSAGE, 401);
  }
}
