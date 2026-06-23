import { AppError } from "./AppError.js";

export class ConflictError extends AppError {
  constructor(message = "Registro já existente.") {
    super(message, 409, "CONFLICT");
  }
}
