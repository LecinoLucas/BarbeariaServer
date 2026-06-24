import { AppError } from "./AppError.js";

export class ServiceUnavailableError extends AppError {
  constructor(message = "Serviço temporariamente indisponível.", meta = null) {
    super(message, 503, "SERVICE_UNAVAILABLE", meta);
  }
}
