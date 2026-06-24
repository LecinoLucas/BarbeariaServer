import assert from "node:assert/strict";
import test from "node:test";

import { ROLES } from "../../constants/roles.js";
import { USER_STATUS } from "../../constants/userStatus.js";
import { BadRequestError } from "../../errors/BadRequestError.js";
import { ForbiddenError } from "../../errors/ForbiddenError.js";
import { ServiceUnavailableError } from "../../errors/ServiceUnavailableError.js";
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
    signupUsers: [],
    signupClients: [],
  };

  const calls = {
    updateClientAuthLastLoginAt: [],
    updateClientAuthPasswordHash: [],
    updateClientAuthGoogleId: [],
    createClientAuthSignup: [],
    verifyGoogleIdToken: [],
  };

  const service = createClientAuthService({
    async findClientAuthUserByEmail(email) {
      if (typeof overrides.findClientAuthUserByEmail === "function") {
        return overrides.findClientAuthUserByEmail(email);
      }

      return overrides.findClientAuthUserByEmailResult ?? store.userByEmail;
    },
    async findClientAuthUserById() {
      return overrides.findClientAuthUserByIdResult ?? store.userByEmail;
    },
    async findClientAuthUserByGoogleId(googleId) {
      return overrides.findClientAuthUserByGoogleIdResult ??
        store.signupUsers.find((user) => user.googleId === googleId) ??
        null;
    },
    async findClientAuthSignupCandidateByEmail(email) {
      return overrides.findClientAuthSignupCandidateByEmailResult ??
        store.signupClients.find((client) => client.email === email) ??
        null;
    },
    async findClientAuthSignupCandidateByPhone(phone) {
      return overrides.findClientAuthSignupCandidateByPhoneResult ??
        store.signupClients.find((client) => client.phone === phone) ??
        null;
    },
    async createClientAuthSignup(payload) {
      calls.createClientAuthSignup.push(payload);

      const user = {
        id: "user-signup-1",
        name: payload.userData.name,
        email: payload.userData.email,
        googleId: payload.userData.googleId ?? null,
        role: payload.userData.role,
        status: payload.userData.status,
      };
      const client = {
        id: payload.existingClientId ?? "client-signup-1",
        userId: user.id,
        name: payload.clientData.name,
        phone: payload.clientData.phone,
        email: payload.clientData.email,
        birthDate: null,
        status: payload.clientData.status,
        deletedAt: null,
      };

      store.signupUsers.push(user);
      if (payload.existingClientId) {
        const hasExisting = store.signupClients.some((item) => item.id === payload.existingClientId);
        store.signupClients = hasExisting
          ? store.signupClients.map((item) =>
              item.id === payload.existingClientId ? client : item,
            )
          : [...store.signupClients, client];
      } else {
        store.signupClients = [...store.signupClients, client];
      }

      return overrides.createClientAuthSignupResult ?? { user, client };
    },
    async getClientPortalSettings() {
      return (
        overrides.getClientPortalSettingsResult ?? {
          enabled: true,
          selfSignupEnabled: true,
          requireAdminApproval: false,
          googleLoginEnabled: false,
        }
      );
    },
    async verifyGoogleIdToken(credential) {
      calls.verifyGoogleIdToken.push(credential);
      return (
        overrides.verifyGoogleIdTokenResult ?? {
          googleId: "google-sub-1",
          email: "google@alphamen.com",
          name: "Cliente Google",
          picture: null,
        }
      );
    },
    async updateClientAuthLastLoginAt(id) {
      calls.updateClientAuthLastLoginAt.push(id);
      return null;
    },
    async updateClientAuthGoogleId(id, googleId) {
      calls.updateClientAuthGoogleId.push({ id, googleId });
      store.userByEmail = {
        ...store.userByEmail,
        googleId,
      };
      return overrides.updateClientAuthGoogleIdResult ?? store.userByEmail;
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

function buildSignupClient(overrides = {}) {
  return {
    id: "client-signup-1",
    userId: null,
    name: "Cliente Cadastro",
    phone: "62999990000",
    email: "cadastro@alphamen.com",
    birthDate: null,
    status: USER_STATUS.ACTIVE,
    deletedAt: null,
    ...overrides,
  };
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

test("troca de senha bloqueia usuário criado via Google sem passwordHash", async () => {
  const { service } = await createHarness({
    findClientAuthUserByIdResult: await buildUser({
      passwordHash: null,
    }),
  });

  await assert.rejects(
    () =>
      service.changePassword("user-client-1", {
        currentPassword: "secret123",
        newPassword: "novaSenha123",
      }),
    BadRequestError,
  );
});

test("signup habilitado cria user CLIENT e client vinculado com login automático", async () => {
  const { service, calls } = await createHarness({
    findClientAuthUserByEmail: async (email) =>
      email === "novo@alphamen.com" ? null : null,
    findClientAuthUserByIdResult: await buildUser(),
  });

  const result = await service.signup({
    name: "Novo Cliente",
    phone: "(62) 99999-0000",
    email: "NOVO@alphamen.com",
    password: "secret123",
    confirmPassword: "secret123",
  });

  assert.equal(result.requiresAdminApproval, false);
  assert.equal(typeof result.accessToken, "string");
  assert.equal(typeof result.refreshToken, "string");
  assert.equal(result.user.role, ROLES.CLIENT);
  assert.equal(result.user.status, USER_STATUS.ACTIVE);
  assert.equal(calls.createClientAuthSignup[0].clientData.email, "novo@alphamen.com");
  assert.equal(result.client.email, "novo@alphamen.com");
  assert.equal("passwordHash" in result.user, false);
  assert.equal(calls.createClientAuthSignup[0].userData.role, ROLES.CLIENT);
  assert.equal(calls.createClientAuthSignup[0].userData.passwordHash === "secret123", false);
});

test("signup desabilitado bloqueia o cadastro público", async () => {
  const { service } = await createHarness({
    getClientPortalSettingsResult: {
      enabled: true,
      selfSignupEnabled: false,
      requireAdminApproval: false,
    },
    findClientAuthUserByEmail: async (email) =>
      email === "novo@alphamen.com" ? null : null,
  });

  await assert.rejects(
    () =>
      service.signup({
        name: "Novo Cliente",
        phone: "(62) 99999-0000",
        email: "novo@alphamen.com",
        password: "secret123",
        confirmPassword: "secret123",
      }),
    ForbiddenError,
  );
});

test("signup bloqueia email duplicado", async () => {
  const duplicatedUser = await buildUser({
    email: "duplicado@alphamen.com",
  });
  const { service } = await createHarness({
    findClientAuthUserByEmail: async (email) =>
      email === "duplicado@alphamen.com" ? duplicatedUser : null,
  });

  await assert.rejects(
    () =>
      service.signup({
        name: "Novo Cliente",
        phone: "(62) 99999-0000",
        email: "duplicado@alphamen.com",
        password: "secret123",
        confirmPassword: "secret123",
      }),
    BadRequestError,
  );
});

test("signup vincula client existente somente quando email e telefone conferem exatamente", async () => {
  const existingClient = buildSignupClient({
    id: "client-existing-1",
    name: "Cliente Legado",
    phone: "(62) 99999-0000",
    email: "cadastro@alphamen.com",
  });
  const { service, calls } = await createHarness({
    findClientAuthUserByEmail: async (email) =>
      email === "cadastro@alphamen.com" ? null : null,
    findClientAuthSignupCandidateByEmailResult: existingClient,
    findClientAuthSignupCandidateByPhoneResult: existingClient,
  });

  const result = await service.signup({
    name: "Cliente Atualizado",
    phone: "(62) 99999-0000",
    email: "cadastro@alphamen.com",
    password: "secret123",
    confirmPassword: "secret123",
  });

  assert.equal(calls.createClientAuthSignup[0].existingClientId, "client-existing-1");
  assert.equal(result.client.id, "client-existing-1");
  assert.equal(calls.createClientAuthSignup[0].clientData.name, "Cliente Atualizado");
});

test("signup bloqueia vínculo inseguro quando email e telefone apontam para clientes diferentes", async () => {
  const { service } = await createHarness({
    findClientAuthUserByEmail: async (email) =>
      email === "cadastro@alphamen.com" ? null : null,
    findClientAuthSignupCandidateByEmailResult: buildSignupClient({
      id: "client-email",
      phone: "(62) 99999-1111",
    }),
    findClientAuthSignupCandidateByPhoneResult: buildSignupClient({
      id: "client-phone",
      email: "outro@alphamen.com",
      phone: "(62) 99999-0000",
    }),
  });

  await assert.rejects(
    () =>
      service.signup({
        name: "Cliente Atualizado",
        phone: "(62) 99999-0000",
        email: "cadastro@alphamen.com",
        password: "secret123",
        confirmPassword: "secret123",
      }),
    BadRequestError,
  );
});

test("signup com aprovação obrigatória não retorna sessão e mantém login bloqueado até ativação", async () => {
  let pendingUserCreated = false;
  const { service, calls } = await createHarness({
    getClientPortalSettingsResult: {
      enabled: true,
      selfSignupEnabled: true,
      requireAdminApproval: true,
    },
    findClientAuthUserByEmail: async (email) => {
      if (email === "aprovacao@alphamen.com" && !pendingUserCreated) {
        return null;
      }

      return buildUser({
        id: "user-signup-1",
        name: "Cliente Pendente",
        email: "aprovacao@alphamen.com",
        status: USER_STATUS.INACTIVE,
        client: {
          id: "client-signup-1",
          userId: "user-signup-1",
          name: "Cliente Pendente",
          phone: "(62) 99999-0000",
          email: "aprovacao@alphamen.com",
          birthDate: null,
          status: USER_STATUS.ACTIVE,
          deletedAt: null,
        },
      });
    },
    async createClientAuthSignup(payload) {
      pendingUserCreated = true;
      calls.createClientAuthSignup.push(payload);
      return {
        user: {
          id: "user-signup-1",
          name: payload.userData.name,
          email: payload.userData.email,
          role: payload.userData.role,
          status: payload.userData.status,
        },
        client: {
          id: "client-signup-1",
          userId: "user-signup-1",
          name: payload.clientData.name,
          phone: payload.clientData.phone,
          email: payload.clientData.email,
          birthDate: null,
          status: payload.clientData.status,
          deletedAt: null,
        },
      };
    },
  });

  const signupResult = await service.signup({
    name: "Cliente Pendente",
    phone: "(62) 99999-0000",
    email: "aprovacao@alphamen.com",
    password: "secret123",
    confirmPassword: "secret123",
  });

  assert.equal(signupResult.requiresAdminApproval, true);
  assert.equal("accessToken" in signupResult, false);
  assert.equal(calls.createClientAuthSignup[0].userData.status, USER_STATUS.INACTIVE);
  assert.equal(calls.createClientAuthSignup[0].clientData.status, USER_STATUS.ACTIVE);

  await assert.rejects(
    () =>
      service.login({
        email: "aprovacao@alphamen.com",
        password: "secret123",
      }),
    ForbiddenError,
  );
});

test("login posterior funciona após aprovação manual do acesso", async () => {
  const inactiveUser = await buildUser({
    id: "user-signup-1",
    name: "Cliente Pendente",
    email: "aprovacao@alphamen.com",
    status: USER_STATUS.INACTIVE,
    client: {
      id: "client-signup-1",
      userId: "user-signup-1",
      name: "Cliente Pendente",
      phone: "(62) 99999-0000",
      email: "aprovacao@alphamen.com",
      birthDate: null,
      status: USER_STATUS.ACTIVE,
      deletedAt: null,
    },
  });
  const activeUser = {
    ...inactiveUser,
    status: USER_STATUS.ACTIVE,
  };
  let currentUser = inactiveUser;

  const { service } = await createHarness({
    async findClientAuthUserByEmail(email) {
      return email === "aprovacao@alphamen.com" ? currentUser : null;
    },
  });

  await assert.rejects(
    () =>
      service.login({
        email: "aprovacao@alphamen.com",
        password: "secret123",
      }),
    ForbiddenError,
  );

  currentUser = activeUser;

  const result = await service.login({
    email: "aprovacao@alphamen.com",
    password: "secret123",
  });

  assert.equal(result.user.status, USER_STATUS.ACTIVE);
});

test("signup usa criação transacional e não deixa dados órfãos quando a transação falha", async () => {
  const { service, store } = await createHarness({
    findClientAuthUserByEmail: async (email) =>
      email === "falha@alphamen.com" ? null : null,
    async createClientAuthSignup() {
      throw new Error("transaction failed");
    },
  });

  await assert.rejects(
    () =>
      service.signup({
        name: "Cliente Falha",
        phone: "(62) 99999-0000",
        email: "falha@alphamen.com",
        password: "secret123",
        confirmPassword: "secret123",
      }),
    /transaction failed/,
  );

  assert.equal(store.signupUsers.length, 0);
  assert.equal(store.signupClients.length, 0);
});

test("google login disabled bloqueia", async () => {
  const { service } = await createHarness({
    getClientPortalSettingsResult: {
      enabled: true,
      selfSignupEnabled: true,
      requireAdminApproval: false,
      googleLoginEnabled: false,
    },
  });

  await assert.rejects(
    () => service.loginWithGoogle({ credential: "google-token" }),
    ForbiddenError,
  );
});

test("token inválido do Google bloqueia", async () => {
  const { service } = await createHarness({
    getClientPortalSettingsResult: {
      enabled: true,
      selfSignupEnabled: true,
      requireAdminApproval: false,
      googleLoginEnabled: true,
    },
    async verifyGoogleIdToken() {
      throw new UnauthorizedError("Não foi possível validar sua conta Google.");
    },
  });

  await assert.rejects(
    () => service.loginWithGoogle({ credential: "google-token" }),
    UnauthorizedError,
  );
});

test("GOOGLE_CLIENT_ID ausente bloqueia com erro controlado", async () => {
  const { service } = await createHarness({
    getClientPortalSettingsResult: {
      enabled: true,
      selfSignupEnabled: true,
      requireAdminApproval: false,
      googleLoginEnabled: true,
    },
    async verifyGoogleIdToken() {
      throw new ServiceUnavailableError("Login com Google indisponível no momento.");
    },
  });

  await assert.rejects(
    () => service.loginWithGoogle({ credential: "google-token" }),
    ServiceUnavailableError,
  );
});

test("usuário existente por googleId faz login", async () => {
  const googleUser = await buildUser({
    id: "user-google-1",
    email: "google@alphamen.com",
    googleId: "google-sub-1",
    client: {
      id: "client-google-1",
      userId: "user-google-1",
      name: "Cliente Google",
      phone: null,
      email: "google@alphamen.com",
      birthDate: null,
      status: USER_STATUS.ACTIVE,
      deletedAt: null,
    },
  });
  const { service, calls } = await createHarness({
    getClientPortalSettingsResult: {
      enabled: true,
      selfSignupEnabled: true,
      requireAdminApproval: false,
      googleLoginEnabled: true,
    },
    findClientAuthUserByGoogleIdResult: googleUser,
  });

  const result = await service.loginWithGoogle({ credential: "google-token" });

  assert.equal(result.user.email, "google@alphamen.com");
  assert.equal(result.client.id, "client-google-1");
  assert.deepEqual(calls.updateClientAuthLastLoginAt, ["user-google-1"]);
});

test("usuário CLIENT existente por email vincula googleId e loga", async () => {
  const emailUser = await buildUser({
    id: "user-email-1",
    email: "google@alphamen.com",
    googleId: null,
    client: {
      id: "client-email-1",
      userId: "user-email-1",
      name: "Cliente Google",
      phone: "11999990000",
      email: "google@alphamen.com",
      birthDate: null,
      status: USER_STATUS.ACTIVE,
      deletedAt: null,
    },
  });
  const linkedUser = {
    ...emailUser,
    googleId: "google-sub-1",
  };
  const { service, calls } = await createHarness({
    getClientPortalSettingsResult: {
      enabled: true,
      selfSignupEnabled: true,
      requireAdminApproval: false,
      googleLoginEnabled: true,
    },
    findClientAuthUserByEmail: async (email) =>
      email === "google@alphamen.com" ? emailUser : null,
    updateClientAuthGoogleIdResult: linkedUser,
  });

  const result = await service.loginWithGoogle({ credential: "google-token" });

  assert.equal(result.user.email, "google@alphamen.com");
  assert.deepEqual(calls.updateClientAuthGoogleId, [
    { id: "user-email-1", googleId: "google-sub-1" },
  ]);
  assert.deepEqual(calls.verifyGoogleIdToken, ["google-token"]);
});

test("usuário ADMIN com mesmo email não acessa o portal por Google", async () => {
  const adminUser = await buildUser({
    role: ROLES.ADMIN,
    email: "google@alphamen.com",
  });
  const { service } = await createHarness({
    getClientPortalSettingsResult: {
      enabled: true,
      selfSignupEnabled: true,
      requireAdminApproval: false,
      googleLoginEnabled: true,
    },
    findClientAuthUserByEmail: async (email) =>
      email === "google@alphamen.com" ? adminUser : null,
  });

  await assert.rejects(
    () => service.loginWithGoogle({ credential: "google-token" }),
    ForbiddenError,
  );
});

test("usuário inactive com mesmo email é bloqueado", async () => {
  const inactiveUser = await buildUser({
    email: "google@alphamen.com",
    status: USER_STATUS.INACTIVE,
  });
  const { service } = await createHarness({
    getClientPortalSettingsResult: {
      enabled: true,
      selfSignupEnabled: true,
      requireAdminApproval: false,
      googleLoginEnabled: true,
    },
    findClientAuthUserByEmail: async (email) =>
      email === "google@alphamen.com" ? inactiveUser : null,
  });

  await assert.rejects(
    () => service.loginWithGoogle({ credential: "google-token" }),
    ForbiddenError,
  );
});

test("usuário novo via Google cria User CLIENT + Client e loga com token interno", async () => {
  const { service, calls } = await createHarness({
    getClientPortalSettingsResult: {
      enabled: true,
      selfSignupEnabled: true,
      requireAdminApproval: false,
      googleLoginEnabled: true,
    },
    findClientAuthUserByEmail: async (email) =>
      email === "google@alphamen.com" ? null : null,
  });

  const result = await service.loginWithGoogle({ credential: "google-token" });

  assert.equal(result.requiresAdminApproval, false);
  assert.equal(typeof result.accessToken, "string");
  assert.equal(result.user.role, ROLES.CLIENT);
  assert.equal(calls.createClientAuthSignup[0].userData.googleId, "google-sub-1");
  assert.equal(calls.createClientAuthSignup[0].userData.passwordHash, null);
  assert.equal(calls.createClientAuthSignup[0].clientData.phone, null);
  assert.equal(calls.createClientAuthSignup[0].credential, undefined);
  assert.equal("passwordHash" in result.user, false);
});

test("requireAdminApproval=true cria acesso pendente via Google e não loga", async () => {
  const { service, calls } = await createHarness({
    getClientPortalSettingsResult: {
      enabled: true,
      selfSignupEnabled: true,
      requireAdminApproval: true,
      googleLoginEnabled: true,
    },
    findClientAuthUserByEmail: async (email) =>
      email === "google@alphamen.com" ? null : null,
  });

  const result = await service.loginWithGoogle({ credential: "google-token" });

  assert.equal(result.requiresAdminApproval, true);
  assert.equal("accessToken" in result, false);
  assert.equal(calls.createClientAuthSignup[0].userData.status, USER_STATUS.INACTIVE);
  assert.equal(calls.createClientAuthSignup[0].clientData.status, USER_STATUS.ACTIVE);
});

test("google não cria usuário novo quando self signup está desligado", async () => {
  const { service } = await createHarness({
    getClientPortalSettingsResult: {
      enabled: true,
      selfSignupEnabled: false,
      requireAdminApproval: false,
      googleLoginEnabled: true,
    },
    findClientAuthUserByEmail: async (email) =>
      email === "google@alphamen.com" ? null : null,
  });

  await assert.rejects(
    () => service.loginWithGoogle({ credential: "google-token" }),
    ForbiddenError,
  );
});
