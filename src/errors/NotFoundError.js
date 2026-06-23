import { AppError } from "./AppError.js";

export class NotFoundError extends AppError {
  constructor(message = "Recurso não encontrado.") {
    super(message, 404, "NOT_FOUND");
  }
}
