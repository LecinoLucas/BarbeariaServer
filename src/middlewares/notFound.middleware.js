import { NotFoundError } from "../errors/NotFoundError.js";

export function notFound(req, res, next) {
  return next(
    new NotFoundError(`Rota não encontrada: ${req.method} ${req.originalUrl}`)
  );
}
