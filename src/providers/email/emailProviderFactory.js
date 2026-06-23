import { env } from "../../config/env.js";
import { FakeEmailProvider } from "./fakeEmailProvider.js";
import { ResendEmailProvider } from "./resendEmailProvider.js";
import { EmailProviderError } from "./emailProvider.js";

class UnsupportedEmailProvider {
  constructor(providerName) {
    this.providerName = providerName;
  }

  async sendEmail() {
    throw new EmailProviderError("Provider de e-mail não suportado.", {
      code: "EMAIL_PROVIDER_UNSUPPORTED",
      retryable: false,
      cause: this.providerName,
    });
  }
}

export function createEmailProvider(config = env) {
  if (config.NODE_ENV === "test" || !config.EMAIL_ENABLED) {
    return new FakeEmailProvider();
  }

  if (config.EMAIL_PROVIDER === "resend") {
    return new ResendEmailProvider({
      apiKey: config.RESEND_API_KEY,
      from: config.EMAIL_FROM,
    });
  }

  return new UnsupportedEmailProvider(config.EMAIL_PROVIDER);
}
