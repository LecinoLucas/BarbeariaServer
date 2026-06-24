import assert from "node:assert/strict";
import test from "node:test";

import { ServiceUnavailableError } from "../../errors/ServiceUnavailableError.js";
import { UnauthorizedError } from "../../errors/UnauthorizedError.js";
import { createGoogleAuthProvider } from "./googleAuthProvider.js";

function createTicket(payload) {
  return {
    getPayload() {
      return payload;
    },
  };
}

test("GOOGLE_CLIENT_ID ausente bloqueia com erro controlado", async () => {
  const provider = createGoogleAuthProvider({
    authEnabled: true,
    clientId: "",
    oauthClient: {
      async verifyIdToken() {
        throw new Error("não deveria chamar verifyIdToken");
      },
    },
  });

  await assert.rejects(
    () => provider.verifyIdToken("google-token"),
    ServiceUnavailableError,
  );
});

test("google auth global desabilitado bloqueia", async () => {
  const provider = createGoogleAuthProvider({
    authEnabled: false,
    clientId: "google-client-id",
    oauthClient: {
      async verifyIdToken() {
        throw new Error("não deveria chamar verifyIdToken");
      },
    },
  });

  await assert.rejects(
    () => provider.verifyIdToken("google-token"),
    ServiceUnavailableError,
  );
});

test("token inválido do Google retorna unauthorized", async () => {
  const provider = createGoogleAuthProvider({
    authEnabled: true,
    clientId: "google-client-id",
    oauthClient: {
      async verifyIdToken() {
        throw new Error("invalid token");
      },
    },
  });

  await assert.rejects(
    () => provider.verifyIdToken("google-token"),
    UnauthorizedError,
  );
});

test("email não verificado é bloqueado", async () => {
  const provider = createGoogleAuthProvider({
    authEnabled: true,
    clientId: "google-client-id",
    oauthClient: {
      async verifyIdToken() {
        return createTicket({
          sub: "google-sub-1",
          email: "google@alphamen.com",
          email_verified: false,
          iss: "https://accounts.google.com",
          name: "Cliente Google",
        });
      },
    },
  });

  await assert.rejects(
    () => provider.verifyIdToken("google-token"),
    UnauthorizedError,
  );
});

test("issuer inválido é bloqueado", async () => {
  const provider = createGoogleAuthProvider({
    authEnabled: true,
    clientId: "google-client-id",
    oauthClient: {
      async verifyIdToken() {
        return createTicket({
          sub: "google-sub-1",
          email: "google@alphamen.com",
          email_verified: true,
          iss: "https://example.com",
          name: "Cliente Google",
        });
      },
    },
  });

  await assert.rejects(
    () => provider.verifyIdToken("google-token"),
    UnauthorizedError,
  );
});

test("token válido retorna payload seguro normalizado", async () => {
  const provider = createGoogleAuthProvider({
    authEnabled: true,
    clientId: "google-client-id",
    oauthClient: {
      async verifyIdToken({ idToken, audience }) {
        assert.equal(idToken, "google-token");
        assert.equal(audience, "google-client-id");
        return createTicket({
          sub: "google-sub-1",
          email: "GOOGLE@alphamen.com",
          email_verified: true,
          iss: "https://accounts.google.com",
          name: "Cliente Google",
          picture: "https://example.com/avatar.png",
        });
      },
    },
  });

  const result = await provider.verifyIdToken("google-token");

  assert.deepEqual(result, {
    googleId: "google-sub-1",
    email: "google@alphamen.com",
    name: "Cliente Google",
    picture: "https://example.com/avatar.png",
  });
});
