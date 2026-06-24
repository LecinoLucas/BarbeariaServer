import assert from "node:assert/strict";
import test from "node:test";

import { ForbiddenError } from "../../errors/ForbiddenError.js";
import { ROLES } from "../../constants/roles.js";
import clientRoutes from "./client.routes.js";

function findRouteStack(path, method) {
  const layer = clientRoutes.stack.find(
    (entry) => entry.route?.path === path && entry.route.methods?.[method],
  );

  return layer?.route?.stack ?? [];
}

async function expectForbiddenForRole(path, method, role) {
  const stack = findRouteStack(path, method);
  const roleMiddleware = stack[0]?.handle;

  await new Promise((resolve, reject) => {
    roleMiddleware(
      { user: { id: `user-${role.toLowerCase()}`, role } },
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
}

test("POST /:id/portal-access permite apenas ADMIN", async () => {
  await expectForbiddenForRole("/:id/portal-access", "post", ROLES.PROFESSIONAL);
  await expectForbiddenForRole("/:id/portal-access", "post", ROLES.CLIENT);
});

test("PATCH /:id/portal-access/password permite apenas ADMIN", async () => {
  await expectForbiddenForRole("/:id/portal-access/password", "patch", ROLES.PROFESSIONAL);
  await expectForbiddenForRole("/:id/portal-access/password", "patch", ROLES.CLIENT);
});

test("PATCH /:id/portal-access/status permite apenas ADMIN", async () => {
  await expectForbiddenForRole("/:id/portal-access/status", "patch", ROLES.PROFESSIONAL);
  await expectForbiddenForRole("/:id/portal-access/status", "patch", ROLES.CLIENT);
});
