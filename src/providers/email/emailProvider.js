export class EmailProviderError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "EmailProviderError";
    this.code = options.code ?? "EMAIL_PROVIDER_ERROR";
    this.retryable = options.retryable ?? true;
    this.statusCode = options.statusCode ?? null;
    this.cause = options.cause;
  }
}

export class EmailProvider {
  async sendEmail() {
    throw new EmailProviderError("Provider de e-mail não implementado.", {
      code: "EMAIL_PROVIDER_NOT_IMPLEMENTED",
      retryable: false,
    });
  }
}
