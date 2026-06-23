import { EmailProvider, EmailProviderError } from "./emailProvider.js";

const RESEND_API_URL = "https://api.resend.com/emails";
const REQUEST_TIMEOUT_MS = 10000;

function parseBodySafely(bodyText, contentType) {
  if (!bodyText) {
    return null;
  }

  if (contentType?.includes("application/json")) {
    try {
      return JSON.parse(bodyText);
    } catch {
      return null;
    }
  }

  return bodyText;
}

function getProviderMessageId(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  if (typeof payload.id === "string" && payload.id) {
    return payload.id;
  }

  if (payload.data && typeof payload.data.id === "string" && payload.data.id) {
    return payload.data.id;
  }

  return null;
}

export class ResendEmailProvider extends EmailProvider {
  constructor(config) {
    super();
    this.apiKey = config.apiKey;
    this.from = config.from;
  }

  async sendEmail(payload) {
    if (!this.apiKey || !this.from) {
      throw new EmailProviderError("Provider de e-mail não configurado.", {
        code: "EMAIL_PROVIDER_MISCONFIGURED",
        retryable: false,
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(RESEND_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.from,
          to: [payload.to],
          subject: payload.subject,
          html: payload.html,
          text: payload.text,
          ...(payload.replyTo ? { reply_to: payload.replyTo } : {}),
        }),
        signal: controller.signal,
      });

      const bodyText = await response.text();
      const responsePayload = parseBodySafely(
        bodyText,
        response.headers.get("content-type"),
      );

      if (!response.ok) {
        throw new EmailProviderError("Provider de e-mail rejeitou o envio.", {
          code: "EMAIL_PROVIDER_REJECTED",
          retryable: response.status >= 500 || response.status === 429,
          statusCode: response.status,
          cause: responsePayload,
        });
      }

      return {
        provider: "resend",
        providerMessageId: getProviderMessageId(responsePayload),
      };
    } catch (error) {
      if (error instanceof EmailProviderError) {
        throw error;
      }

      if (error?.name === "AbortError") {
        throw new EmailProviderError("Timeout no provider de e-mail.", {
          code: "EMAIL_PROVIDER_TIMEOUT",
          retryable: true,
          cause: error,
        });
      }

      throw new EmailProviderError("Falha ao enviar e-mail pelo provider configurado.", {
        code: "EMAIL_PROVIDER_REQUEST_FAILED",
        retryable: true,
        cause: error,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
