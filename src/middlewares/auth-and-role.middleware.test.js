import assert from "node:assert/strict";
import test from "node:test";

import { ROLES } from "../constants/roles.js";
import { authenticate } from "./auth.middleware.js";
import { authorizeRoles } from "./role.middleware.js";

function createResponseDouble() {
  return {
    body: null,
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

test("authenticate retorna 401 quando o endpoint admin é acessado sem token", async () => {
  const req = { headers: {} };
  const res = createResponseDouble();
  let nextCalled = false;

  await authenticate(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.success, false);
});

test("authorizeRoles permite ADMIN no endpoint admin", async () => {
  const req = { user: { id: "user-1", role: ROLES.ADMIN } };
  const res = createResponseDouble();
  let nextError = null;

  authorizeRoles(ROLES.ADMIN)(req, res, (error) => {
    nextError = error ?? "ok";
  });

  assert.equal(nextError, "ok");
});

test("authorizeRoles bloqueia PROFESSIONAL no endpoint admin com 403 lógico", async () => {
  const req = { user: { id: "user-2", role: ROLES.PROFESSIONAL } };
  const res = createResponseDouble();
  let nextError = null;

  authorizeRoles(ROLES.ADMIN)(req, res, (error) => {
    nextError = error;
  });

  assert.equal(nextError?.statusCode ?? nextError?.status, 403);
});

test("authorizeRoles bloqueia CLIENT no endpoint admin com 403 lógico", async () => {
  const req = { user: { id: "user-3", role: ROLES.CLIENT } };
  const res = createResponseDouble();
  let nextError = null;

  authorizeRoles(ROLES.ADMIN)(req, res, (error) => {
    nextError = error;
  });

  assert.equal(nextError?.statusCode ?? nextError?.status, 403);
});
