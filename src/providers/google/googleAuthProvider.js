import { OAuth2Client } from "google-auth-library";

import { env } from "../../config/env.js";
import { BadRequestError } from "../../errors/BadRequestError.js";
import { ServiceUnavailableError } from "../../errors/ServiceUnavailableError.js";
import { UnauthorizedError } from "../../errors/UnauthorizedError.js";

const INVALID_GOOGLE_CREDENTIAL_MESSAGE =
  "Não foi possível validar sua conta Google.";
const GOOGLE_UNAVAILABLE_MESSAGE =
  "Login com Google indisponível no momento.";
const VALID_GOOGLE_ISSUERS = new Set([
  "accounts.google.com",
  "https://accounts.google.com",
]);

function normalizeGoogleName(name, email) {
  if (typeof name === "string" && name.trim()) {
    return name.trim();
  }

  return email;
}

function isEmailVerified(value) {
  return value === true || value === "true";
}

export function createGoogleAuthProvider(deps = {}) {
  const clientId = deps.clientId ?? env.GOOGLE_CLIENT_ID;
  const authEnabled = deps.authEnabled ?? env.GOOGLE_AUTH_ENABLED;
  const OAuth2ClientClass = deps.OAuth2ClientClass ?? OAuth2Client;
  const oauthClient = deps.oauthClient ?? new OAuth2ClientClass(clientId || undefined);

  return {
    async verifyIdToken(credential) {
      if (!authEnabled) {
        throw new ServiceUnavailableError(GOOGLE_UNAVAILABLE_MESSAGE);
      }

      if (!clientId) {
        throw new ServiceUnavailableError(GOOGLE_UNAVAILABLE_MESSAGE);
      }

      if (typeof credential !== "string" || credential.trim().length === 0) {
        throw new BadRequestError("Credencial do Google é obrigatória.");
      }

      let payload;

      try {
        const ticket = await oauthClient.verifyIdToken({
          idToken: credential.trim(),
          audience: clientId,
        });

        payload = ticket?.getPayload?.();
      } catch {
        throw new UnauthorizedError(INVALID_GOOGLE_CREDENTIAL_MESSAGE);
      }

      if (!payload || typeof payload !== "object") {
        throw new UnauthorizedError(INVALID_GOOGLE_CREDENTIAL_MESSAGE);
      }

      if (!VALID_GOOGLE_ISSUERS.has(payload.iss)) {
        throw new UnauthorizedError(INVALID_GOOGLE_CREDENTIAL_MESSAGE);
      }

      if (!payload.sub || !payload.email || !isEmailVerified(payload.email_verified)) {
        throw new UnauthorizedError(INVALID_GOOGLE_CREDENTIAL_MESSAGE);
      }

      return {
        googleId: payload.sub,
        email: payload.email.trim().toLowerCase(),
        name: normalizeGoogleName(payload.name, payload.email),
        picture: typeof payload.picture === "string" ? payload.picture : null,
      };
    },
  };
}

const defaultProvider = createGoogleAuthProvider();

export const verifyGoogleIdToken = defaultProvider.verifyIdToken;
