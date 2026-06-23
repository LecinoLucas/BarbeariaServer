import { AppError } from "./AppError.js";

export class UnauthorizedError extends AppError {
  constructor(message = "Não autorizado.") {
    super(message, 401, "UNAUTHORIZED");
  }
}
