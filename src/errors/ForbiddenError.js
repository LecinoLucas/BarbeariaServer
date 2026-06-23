import { AppError } from "./AppError.js";

export class ForbiddenError extends AppError {
  constructor(message = "Acesso negado.") {
    super(message, 403, "FORBIDDEN");
  }
}
