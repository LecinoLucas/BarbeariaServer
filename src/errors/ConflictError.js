import { AppError } from "./AppError.js";

export class ConflictError extends AppError {
  constructor(message = "Registro já existente.", code = "CONFLICT", meta = null) {
    super(message, 409, code, meta);
  }
}
