import { Prisma } from "@prisma/client";

import { env } from "../config/env.js";
import { AppError } from "../errors/AppError.js";

function buildErrorBody(message, code, details, meta = null) {
  return {
    success: false,
    message,
    error: {
      code,
      ...(details?.length > 0 && { details }),
      ...(meta ?? {}),
    },
  };
}

export function errorHandler(err, req, res, next) {
  const isOperational = err instanceof AppError;
  if (!isOperational) {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} →`, err);
  }

  if (err instanceof AppError) {
    return res
      .status(err.statusCode)
      .json(buildErrorBody(err.message, err.code, err.details, err.meta));
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(409).json(buildErrorBody("Registro já existente.", "CONFLICT"));
    }
    if (err.code === "P2025" || err.code === "P2001") {
      return res.status(404).json(buildErrorBody("Registro não encontrado.", "NOT_FOUND"));
    }
    if (err.code === "P2003") {
      return res.status(422).json(buildErrorBody("Referência inválida.", "UNPROCESSABLE"));
    }
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    return res.status(503).json(buildErrorBody("Serviço temporariamente indisponível.", "SERVICE_UNAVAILABLE"));
  }

  if (
    err.name === "TokenExpiredError" ||
    err.name === "JsonWebTokenError"
  ) {
    return res
      .status(401)
      .json(buildErrorBody("Token inválido ou expirado.", "UNAUTHORIZED"));
  }

  if (err instanceof SyntaxError && err.status === 400) {
    return res
      .status(400)
      .json(buildErrorBody("JSON inválido.", "BAD_REQUEST"));
  }

  return res
    .status(500)
    .json(buildErrorBody("Erro interno do servidor.", "INTERNAL_SERVER_ERROR"));
}
