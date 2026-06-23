import { USER_STATUS } from "../constants/userStatus.js";
import { findSafeUserById } from "../modules/auth/auth.repository.js";
import { verifyAccessToken } from "../utils/jwt.js";

function getSocketToken(socket) {
  const authToken = socket.handshake.auth?.token;

  if (authToken && typeof authToken === "string") {
    return authToken.trim();
  }

  const authorizationHeader = socket.handshake.headers.authorization;

  if (typeof authorizationHeader === "string" && authorizationHeader.startsWith("Bearer ")) {
    return authorizationHeader.slice(7).trim();
  }

  return null;
}

export async function authenticateSocket(socket, next) {
  try {
    const token = getSocketToken(socket);

    if (!token) {
      return next(new Error("Connection error"));
    }

    const payload = verifyAccessToken(token);

    if (!payload || typeof payload !== "object" || typeof payload.sub !== "string") {
      return next(new Error("Connection error"));
    }

    const user = await findSafeUserById(payload.sub);

    if (!user || user.status !== USER_STATUS.ACTIVE) {
      return next(new Error("Connection error"));
    }

    socket.user = user;

    return next();
  } catch {
    return next(new Error("Connection error"));
  }
}
