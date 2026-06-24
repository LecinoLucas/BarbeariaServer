import assert from "node:assert/strict";
import test from "node:test";

import { ROLES } from "../../constants/roles.js";
import { USER_STATUS } from "../../constants/userStatus.js";
import { ConflictError } from "../../errors/ConflictError.js";
import { ForbiddenError } from "../../errors/ForbiddenError.js";
import { NotFoundError } from "../../errors/NotFoundError.js";
import { createClientService } from "./client.service.js";

function buildClient(overrides = {}) {
  return {
    id: "client-1",
    userId: null,
    name: "Cliente Alpha",
    phone: "11999999999",
    email: "cliente@alphamen.com",
    birthDate: null,
    notes: null,
    status: USER_STATUS.ACTIVE,
    createdAt: new Date("2026-06-24T10:00:00.000Z"),
    updatedAt: new Date("2026-06-24T10:00:00.000Z"),
    ...overrides,
  };
}

function buildPortalUser(overrides = {}) {
  return {
    id: "user-client-1",
    email: "portal@alphamen.com",
    role: ROLES.CLIENT,
    status: USER_STATUS.ACTIVE,
    ...overrides,
  };
}

function createHarness(overrides = {}) {
  const calls = {
    findUserByEmail: [],
    hashPassword: [],
    createPortalAccessForClient: [],
    updatePortalAccessPassword: [],
    updatePortalAccessStatus: [],
  };

  const store = {
    client: buildClient(),
    linkedUser: null,
    usersByIds: [],
  };

  const service = createClientService({
    async findById(id) {
      if (id !== store.client?.id) {
        return overrides.findByIdResult ?? null;
      }

      return overrides.findByIdResult ?? store.client;
    },
    async findByUserId(userId) {
      return overrides.findByUserIdResult ?? (store.client?.userId === userId ? store.client : null);
    },
    async findByPhone() {
      return null;
    },
    async findByPhoneIgnoringId() {
      return null;
    },
    async findByEmail() {
      return null;
    },
    async findByEmailIgnoringId() {
      return null;
    },
    async listPortalAccessUsersByIds(ids) {
      return overrides.listPortalAccessUsersByIdsResult ?? store.usersByIds.filter((user) => ids.includes(user.id));
    },
    async findPortalAccessUserById(userId) {
      return overrides.findPortalAccessUserByIdResult ??
        (store.linkedUser?.id === userId ? store.linkedUser : null);
    },
    async createPortalAccessForClient(clientId, payload) {
      calls.createPortalAccessForClient.push({ clientId, payload });

      const user = {
        id: "user-client-1",
        email: payload.email,
        role: payload.role,
        status: payload.status,
      };

      store.linkedUser = user;
      store.usersByIds = [user];
      store.client = {
        ...store.client,
        userId: user.id,
      };

      return overrides.createPortalAccessForClientResult ?? {
        client: store.client,
        user,
      };
    },
    async updatePortalAccessPassword(userId, passwordHash) {
      calls.updatePortalAccessPassword.push({ userId, passwordHash });
      return null;
    },
    async updatePortalAccessStatus(userId, status) {
      calls.updatePortalAccessStatus.push({ userId, status });
      if (store.linkedUser?.id === userId) {
        store.linkedUser = {
          ...store.linkedUser,
          status,
        };
        store.usersByIds = [store.linkedUser];
      }

      return null;
    },
    async findUserByEmail(email) {
      calls.findUserByEmail.push(email);
      return overrides.findUserByEmailResult ?? null;
    },
    async hashPassword(password) {
      calls.hashPassword.push(password);
      return overrides.hashPasswordResult ?? `hashed:${password}`;
    },
    ...overrides,
  });

  return { calls, service, store };
}

test("ADMIN cria acesso para cliente sem user vinculado", async () => {
  const { service, calls } = createHarness();

  const result = await service.createClientPortalAccess("client-1", {
    email: "PORTAL@alphamen.com",
    password: "secret123",
  });

  assert.equal(result.portalAccess.enabled, true);
  assert.equal(result.portalAccess.email, "portal@alphamen.com");
  assert.equal(result.portalAccess.status, USER_STATUS.ACTIVE);
  assert.equal("passwordHash" in result, false);
  assert.equal(calls.hashPassword[0], "secret123");
  assert.equal(calls.findUserByEmail[0], "portal@alphamen.com");
  assert.equal(calls.createPortalAccessForClient[0].payload.role, ROLES.CLIENT);
});

test("bloqueia cliente inexistente ao criar acesso", async () => {
  const { service } = createHarness({
    findByIdResult: null,
  });

  await assert.rejects(
    () =>
      service.createClientPortalAccess("missing-client", {
        email: "portal@alphamen.com",
        password: "secret123",
      }),
    NotFoundError,
  );
});

test("bloqueia cliente inativo ao criar acesso", async () => {
  const { service } = createHarness({
    findByIdResult: buildClient({ status: USER_STATUS.INACTIVE }),
  });

  await assert.rejects(
    () =>
      service.createClientPortalAccess("client-1", {
        email: "portal@alphamen.com",
        password: "secret123",
      }),
    ConflictError,
  );
});

test("bloqueia email já usado por outro usuário", async () => {
  const { service } = createHarness({
    findUserByEmailResult: buildPortalUser({ id: "user-other-1", email: "portal@alphamen.com" }),
  });

  await assert.rejects(
    () =>
      service.createClientPortalAccess("client-1", {
        email: "portal@alphamen.com",
        password: "secret123",
      }),
    ConflictError,
  );
});

test("não duplica acesso quando client já possui userId", async () => {
  const { service } = createHarness({
    findByIdResult: buildClient({ userId: "user-client-1" }),
  });

  await assert.rejects(
    () =>
      service.createClientPortalAccess("client-1", {
        email: "portal@alphamen.com",
        password: "secret123",
      }),
    ConflictError,
  );
});

test("redefine senha do user vinculado", async () => {
  const linkedUser = buildPortalUser();
  const { service, calls } = createHarness({
    findByIdResult: buildClient({ userId: linkedUser.id }),
    findPortalAccessUserByIdResult: linkedUser,
    listPortalAccessUsersByIdsResult: [linkedUser],
  });

  const result = await service.resetClientPortalPassword("client-1", {
    password: "novaSenha123",
  });

  assert.equal(result.portalAccess.email, linkedUser.email);
  assert.equal(calls.hashPassword[0], "novaSenha123");
  assert.deepEqual(calls.updatePortalAccessPassword[0], {
    userId: linkedUser.id,
    passwordHash: "hashed:novaSenha123",
  });
});

test("ativa acesso do cliente vinculado", async () => {
  const linkedUser = buildPortalUser({ status: USER_STATUS.INACTIVE });
  const { service } = createHarness({
    findByIdResult: buildClient({ userId: linkedUser.id }),
    findPortalAccessUserByIdResult: linkedUser,
    listPortalAccessUsersByIdsResult: [buildPortalUser({ status: USER_STATUS.ACTIVE })],
    updatePortalAccessStatus(userId, status) {
      assert.equal(userId, linkedUser.id);
      assert.equal(status, USER_STATUS.ACTIVE);
      return null;
    },
  });

  const result = await service.updateClientPortalAccessStatus("client-1", {
    status: USER_STATUS.ACTIVE,
  });

  assert.equal(result.portalAccess.status, USER_STATUS.ACTIVE);
});

test("desativa acesso do cliente vinculado", async () => {
  const linkedUser = buildPortalUser({ status: USER_STATUS.ACTIVE });
  const { service } = createHarness({
    findByIdResult: buildClient({ userId: linkedUser.id }),
    findPortalAccessUserByIdResult: linkedUser,
    listPortalAccessUsersByIdsResult: [buildPortalUser({ status: USER_STATUS.INACTIVE })],
    updatePortalAccessStatus(userId, status) {
      assert.equal(userId, linkedUser.id);
      assert.equal(status, USER_STATUS.INACTIVE);
      return null;
    },
  });

  const result = await service.updateClientPortalAccessStatus("client-1", {
    status: USER_STATUS.INACTIVE,
  });

  assert.equal(result.portalAccess.status, USER_STATUS.INACTIVE);
});

test("getClientById respeita acesso do cliente autenticado", async () => {
  const ownClient = buildClient({ id: "client-1", userId: "user-client-1" });
  const { service } = createHarness({
    findByIdResult: ownClient,
    findByUserIdResult: ownClient,
    listPortalAccessUsersByIdsResult: [buildPortalUser({ id: "user-client-1" })],
  });

  const result = await service.getClientById("client-1", {
    id: "user-client-1",
    role: ROLES.CLIENT,
  });

  assert.equal(result.id, "client-1");
});

test("CLIENT não acessa outro cliente", async () => {
  const { service } = createHarness({
    findByIdResult: buildClient({ id: "client-1", userId: "user-client-1" }),
    findByUserIdResult: buildClient({ id: "client-2", userId: "user-client-2" }),
  });

  await assert.rejects(
    () =>
      service.getClientById("client-1", {
        id: "user-client-2",
        role: ROLES.CLIENT,
      }),
    ForbiddenError,
  );
});
