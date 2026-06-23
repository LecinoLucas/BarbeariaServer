import { EmailProvider } from "./emailProvider.js";

export class FakeEmailProvider extends EmailProvider {
  async sendEmail(payload) {
    const providerMessageId =
      payload?.metadata?.idempotencyKey
        ? `fake-email:${payload.metadata.idempotencyKey}`
        : "fake-email:unknown";

    return {
      provider: "fake",
      providerMessageId,
    };
  }
}
