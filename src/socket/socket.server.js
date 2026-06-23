import { Server } from "socket.io";

import { env } from "../config/env.js";
import { ROLES } from "../constants/roles.js";
import { authenticateSocket } from "./socket.auth.js";
import { SOCKET_EVENTS } from "./socket.events.js";

let ioInstance = null;

export function setupSocket(server) {
  if (ioInstance) {
    return ioInstance;
  }

  ioInstance = new Server(server, {
    cors: {
      origin: env.CLIENT_URL,
      credentials: true,
    },
  });

  ioInstance.use(authenticateSocket);

  ioInstance.on("connection", (socket) => {
    const user = socket.user;

    socket.join(`user:${user.id}`);

    if (user.role === ROLES.ADMIN) {
      socket.join("admins");
    }

    if (env.isDev) {
      console.log(`[socket] connected user=${user.id} role=${user.role}`);
    }

    socket.emit(SOCKET_EVENTS.CONNECTED, {
      userId: user.id,
      role: user.role,
    });
  });

  return ioInstance;
}

export function getIO() {
  return ioInstance;
}
