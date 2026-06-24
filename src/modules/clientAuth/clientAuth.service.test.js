import assert from "node:assert/strict";
import test from "node:test";

import { ROLES } from "../../constants/roles.js";
import { USER_STATUS } from "../../constants/userStatus.js";
import { BadRequestError } from "../../errors/BadRequestError.js";
import { ForbiddenError } from "../../errors/ForbiddenError.js";
import { UnauthorizedError } from "../../errors/UnauthorizedError.js";
import { hashPassword } from "../../utils/hash.js";
import { generateRefreshToken } from "../../utils/jwt.js";
import { createClientAuthService } from "./clientAuth.service.js";

async function buildUser(overrides = {}) {
  const passwordHash = await hashPassword(overrides.rawPassword ?? "secret123");

  return {
    id: "user-client-1",
    name: "Cliente Alpha",
    email: "cliente@alphamen.com",
    passwordHash,
    role: ROLES.CLIENT,
    status: USER_STATUS.ACTIVE,
    deletedAt: null,
    client: {
      id: "client-1",
      userId: "user-client-1",
      name: "Cliente Alpha",
      phone: "11999999999",
      email: "cliente@alphamen.com",
      birthDate: null,
      status: USER_STATUS.ACTIVE,
      deletedAt: null,
    },
    ...overrides,
  };
}

async function createHarness(overrides = {}) {
  const store = {
    userByEmail: await buildUser(),
  };

  const calls = {
    updateClientAuthLastLoginAt: [],
    updateClientAuthPasswordHash: [],
  };

  const service = createClientAuthService({
    async findClientAuthUserByEmail() {
      return overrides.findClientAuthUserByEmailResult ?? store.userByEmail;
    },
    async findClientAuthUserById() {
      return overrides.findClientAuthUserByIdResult ?? store.userByEmail;
    },
    async updateClientAuthLastLoginAt(id) {
      calls.updateClientAuthLastLoginAt.push(id);
      return null;
    },
    async updateClientAuthPasswordHash(id, passwordHash) {
      calls.updateClientAuthPasswordHash.push({ id, passwordHash });
      store.userByEmail = {
        ...store.userByEmail,
        passwordHash,
      };
      return null;
    },
    ...overrides,
  });

  return { calls, service, store };
}

test("cliente válido consegue login", async () => {
  const { service, calls } = await createHarness();

  const result = await service.login({
    email: "cliente@alphamen.com",
    password: "secret123",
  });

  assert.equal(typeof result.accessToken, "string");
  assert.equal(typeof result.refreshToken, "string");
  assert.equal(result.user.role, ROLES.CLIENT);
  assert.equal(result.client.id, "client-1");
  assert.deepEqual(calls.updateClientAuthLastLoginAt, ["user-client-1"]);
});

test("admin não consegue login no client auth", async () => {
  const { service } = await createHarness({
    findClientAuthUserByEmailResult: await buildUser({ role: ROLES.ADMIN }),
  });

  await assert.rejects(
    () => service.login({ email: "admin@alphamen.com", password: "secret123" }),
    ForbiddenError,
  );
});

test("professional não consegue login no client auth", async () => {
  const { service } = await createHarness({
    findClientAuthUserByEmailResult: await buildUser({ role: ROLES.PROFESSIONAL }),
  });

  await assert.rejects(
    () => service.login({ email: "pro@alphamen.com", password: "secret123" }),
    ForbiddenError,
  );
});

test("cliente inativo não consegue login", async () => {
  const { service } = await createHarness({
    findClientAuthUserByEmailResult: await buildUser({ status: USER_STATUS.INACTIVE }),
  });

  await assert.rejects(
    () => service.login({ email: "cliente@alphamen.com", password: "secret123" }),
    ForbiddenError,
  );
});

test("client vinculado inativo não consegue login", async () => {
  const { service } = await createHarness({
    findClientAuthUserByEmailResult: await buildUser({
      client: {
        id: "client-1",
        userId: "user-client-1",
        name: "Cliente Alpha",
        phone: "11999999999",
        email: "cliente@alphamen.com",
        birthDate: null,
        status: USER_STATUS.INACTIVE,
        deletedAt: null,
      },
    }),
  });

  await assert.rejects(
    () => service.login({ email: "cliente@alphamen.com", password: "secret123" }),
    ForbiddenError,
  );
});

test("senha inválida retorna 401", async () => {
  const { service } = await createHarness();

  await assert.rejects(
    () => service.login({ email: "cliente@alphamen.com", password: "wrong999" }),
    UnauthorizedError,
  );
});

test("cliente sem vínculo Client retorna erro controlado", async () => {
  const { service } = await createHarness({
    findClientAuthUserByEmailResult: await buildUser({ client: null }),
  });

  await assert.rejects(
    () => service.login({ email: "cliente@alphamen.com", password: "secret123" }),
    ForbiddenError,
  );
});

test("refresh válido retorna novo accessToken", async () => {
  const { service, store } = await createHarness();
  const token = generateRefreshToken({
    id: store.userByEmail.id,
    email: store.userByEmail.email,
    role: store.userByEmail.role,
  });

  const result = await service.refresh(token);

  assert.equal(typeof result.accessToken, "string");
  assert.equal(result.user.id, store.userByEmail.id);
  assert.equal(result.client.id, "client-1");
});

test("refresh sem cookie falha", async () => {
  const { service } = await createHarness();

  await assert.rejects(() => service.refresh(undefined), UnauthorizedError);
});

test("refresh com usuário não CLIENT falha", async () => {
  const user = await buildUser({ role: ROLES.ADMIN });
  const { service } = await createHarness({
    findClientAuthUserByIdResult: user,
  });
  const token = generateRefreshToken({
    id: user.id,
    email: user.email,
    role: user.role,
  });

  await assert.rejects(() => service.refresh(token), ForbiddenError);
});

test("me com CLIENT válido retorna user + client sem passwordHash", async () => {
  const { service } = await createHarness();

  const result = await service.me("user-client-1");

  assert.equal(result.user.id, "user-client-1");
  assert.equal(result.client.id, "client-1");
  assert.equal("passwordHash" in result.user, false);
});

test("troca de senha com senha atual correta atualiza o próprio usuário", async () => {
  const { service, store, calls } = await createHarness();

  await service.changePassword("user-client-1", {
    currentPassword: "secret123",
    newPassword: "novaSenha123",
  });

  assert.equal(calls.updateClientAuthPasswordHash.length, 1);

  const login = await service.login({
    email: store.userByEmail.email,
    password: "novaSenha123",
  });

  assert.equal(login.user.id, "user-client-1");
});

test("senha atual errada falha", async () => {
  const { service } = await createHarness();

  await assert.rejects(
    () =>
      service.changePassword("user-client-1", {
        currentPassword: "errada123",
        newPassword: "novaSenha123",
      }),
    UnauthorizedError,
  );
});

test("não permite nova senha igual à atual", async () => {
  const { service } = await createHarness();

  await assert.rejects(
    () =>
      service.changePassword("user-client-1", {
        currentPassword: "secret123",
        newPassword: "secret123",
      }),
    BadRequestError,
  );
});
