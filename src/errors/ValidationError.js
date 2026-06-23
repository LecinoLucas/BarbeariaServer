import { AppError } from "./AppError.js";

export class ValidationError extends AppError {
  constructor(zodError) {
    super("Erro de validação.", 422, "VALIDATION_ERROR");
    this.details = zodError.issues.map((e) => ({
      field: e.path.join("."),
      message: e.message,
    }));
  }
}
