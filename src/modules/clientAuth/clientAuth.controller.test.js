import assert from "node:assert/strict";
import test from "node:test";

import { ForbiddenError } from "../../errors/ForbiddenError.js";
import { UnauthorizedError } from "../../errors/UnauthorizedError.js";
import { ROLES } from "../../constants/roles.js";
import { authorizeRoles } from "../../middlewares/role.middleware.js";
import clientAuthRoutes from "./clientAuth.routes.js";
import {
  CLIENT_REFRESH_TOKEN_COOKIE_NAME,
  createClientAuthController,
  getClientRefreshTokenCookieOptions,
} from "./clientAuth.controller.js";

function createResponseDouble() {
  return {
    statusCode: 200,
    body: null,
    cookieCalls: [],
    clearCookieCalls: [],
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    cookie(name, value, options) {
      this.cookieCalls.push({ name, value, options });
      return this;
    },
    clearCookie(name, options) {
      this.clearCookieCalls.push({ name, options });
      return this;
    },
  };
}

function findRouteStack(path, method) {
  const layer = clientAuthRoutes.stack.find(
    (entry) => entry.route?.path === path && entry.route.methods?.[method],
  );

  return layer?.route?.stack ?? [];
}

test("cookie clientRefreshToken é setado com path correto no login", async () => {
  const controller = createClientAuthController({
    async login() {
      return {
        accessToken: "access-token",
        refreshToken: "refresh-token",
        user: { id: "user-1", role: ROLES.CLIENT },
        client: { id: "client-1", status: "ACTIVE" },
      };
    },
  });
  const res = createResponseDouble();

  await controller.login(
    { body: { email: "cliente@alphamen.com", password: "secret123" } },
    res,
    (error) => {
      throw error;
    },
  );

  assert.equal(res.cookieCalls.length, 1);
  assert.equal(res.cookieCalls[0].name, CLIENT_REFRESH_TOKEN_COOKIE_NAME);
  assert.equal(res.cookieCalls[0].options.path, "/api/client-auth");
  assert.equal(res.body.data.accessToken, "access-token");
});

test("refresh usa apenas clientRefreshToken", async () => {
  let receivedToken = null;
  const controller = createClientAuthController({
    async refresh(token) {
      receivedToken = token;
      return {
        accessToken: "renewed-token",
        user: { id: "user-1", role: ROLES.CLIENT },
        client: { id: "client-1", status: "ACTIVE" },
      };
    },
  });
  const res = createResponseDouble();

  await controller.refresh(
    {
      cookies: {
        refreshToken: "main-refresh",
        clientRefreshToken: "client-refresh",
      },
    },
    res,
    (error) => {
      throw error;
    },
  );

  assert.equal(receivedToken, "client-refresh");
  assert.equal(res.body.data.accessToken, "renewed-token");
});

test("logout limpa clientRefreshToken e não limpa refreshToken principal", () => {
  const controller = createClientAuthController();
  const res = createResponseDouble();

  controller.logout({}, res);

  assert.equal(res.clearCookieCalls.length, 1);
  assert.equal(res.clearCookieCalls[0].name, CLIENT_REFRESH_TOKEN_COOKIE_NAME);
  assert.equal(res.clearCookieCalls[0].options.path, "/api/client-auth");
});

test("me usa o serviço e não retorna passwordHash", async () => {
  const controller = createClientAuthController({
    async me() {
      return {
        user: { id: "user-1", email: "cliente@alphamen.com", role: ROLES.CLIENT },
        client: { id: "client-1", name: "Cliente Alpha" },
      };
    },
  });
  const res = createResponseDouble();

  await controller.me({ user: { id: "user-1" } }, res, (error) => {
    throw error;
  });

  assert.equal("passwordHash" in res.body.data.user, false);
  assert.equal(res.body.data.client.id, "client-1");
});

test("me bloqueia ADMIN no middleware da rota", async () => {
  const stack = findRouteStack("/me", "get");
  const roleMiddleware = stack[1].handle;

  await new Promise((resolve, reject) => {
    roleMiddleware(
      { user: { id: "user-admin", role: ROLES.ADMIN } },
      {},
      (error) => {
        try {
          assert.ok(error instanceof ForbiddenError);
          resolve();
        } catch (assertionError) {
          reject(assertionError);
        }
      },
    );
  });
});

test("me bloqueia PROFESSIONAL no middleware da rota", async () => {
  const stack = findRouteStack("/me", "get");
  const roleMiddleware = stack[1].handle;

  await new Promise((resolve, reject) => {
    roleMiddleware(
      { user: { id: "user-pro", role: ROLES.PROFESSIONAL } },
      {},
      (error) => {
        try {
          assert.ok(error instanceof ForbiddenError);
          resolve();
        } catch (assertionError) {
          reject(assertionError);
        }
      },
    );
  });
});

test("password não permite userId vindo do frontend para alterar outro usuário", async () => {
  let receivedUserId = null;
  let receivedPayload = null;
  const controller = createClientAuthController({
    async changePassword(userId, payload) {
      receivedUserId = userId;
      receivedPayload = payload;
    },
  });
  const res = createResponseDouble();

  await controller.changePassword(
    {
      user: { id: "user-client-1", role: ROLES.CLIENT },
      body: {
        userId: "other-user",
        currentPassword: "secret123",
        newPassword: "novaSenha123",
      },
    },
    res,
    (error) => {
      throw error;
    },
  );

  assert.equal(receivedUserId, "user-client-1");
  assert.deepEqual(receivedPayload, {
    currentPassword: "secret123",
    newPassword: "novaSenha123",
  });
});

test("password bloqueia ADMIN no middleware da rota", async () => {
  const stack = findRouteStack("/password", "patch");
  const roleMiddleware = stack[1].handle;

  await new Promise((resolve, reject) => {
    roleMiddleware(
      { user: { id: "user-admin", role: ROLES.ADMIN } },
      {},
      (error) => {
        try {
          assert.ok(error instanceof ForbiddenError);
          resolve();
        } catch (assertionError) {
          reject(assertionError);
        }
      },
    );
  });
});

test("password com nova senha inválida falha na validação", async () => {
  const controller = createClientAuthController({
    async changePassword() {
      throw new Error("não deveria chamar o service");
    },
  });
  const res = createResponseDouble();

  await controller.changePassword(
    {
      user: { id: "user-client-1", role: ROLES.CLIENT },
      body: {
        currentPassword: "secret123",
        newPassword: "123",
      },
    },
    res,
    (error) => {
      assert.equal(error?.code, "VALIDATION_ERROR");
    },
  );
});

test("refresh sem cookie falha no controller com 401 operacional do serviço", async () => {
  const controller = createClientAuthController({
    async refresh() {
      throw new UnauthorizedError("Não autorizado.");
    },
  });
  const res = createResponseDouble();

  await controller.refresh({ cookies: {} }, res, (error) => {
    assert.ok(error instanceof UnauthorizedError);
  });
});

test("getClientRefreshTokenCookieOptions usa cookie separado do auth principal", () => {
  const options = getClientRefreshTokenCookieOptions();

  assert.equal(options.httpOnly, true);
  assert.equal(options.sameSite, "strict");
  assert.equal(options.path, "/api/client-auth");
});
