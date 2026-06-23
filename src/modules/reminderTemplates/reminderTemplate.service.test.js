import assert from "node:assert/strict";
import test from "node:test";

import { REMINDER_TEMPLATE_CHANNELS } from "../../constants/reminderTemplateChannel.js";
import { REMINDER_TEMPLATE_TYPES } from "../../constants/reminderTemplateType.js";
import { ROLES } from "../../constants/roles.js";
import { BadRequestError } from "../../errors/BadRequestError.js";
import { ForbiddenError } from "../../errors/ForbiddenError.js";
import {
  REMINDER_TEMPLATE_ALLOWED_PLACEHOLDERS,
  createReminderTemplateService,
  getAppointmentReminderEmailRenderer,
  renderReminderTemplate,
} from "./reminderTemplate.service.js";

function buildActor(role) {
  return {
    id: `${role.toLowerCase()}-1`,
    role,
  };
}

function buildTemplate(overrides = {}) {
  return {
    id: "template-1",
    type: REMINDER_TEMPLATE_TYPES.APPOINTMENT_REMINDER,
    channel: REMINDER_TEMPLATE_CHANNELS.EMAIL,
    name: "Lembrete padrao",
    subject: "Lembrete para {cliente}",
    bodyText:
      "Olá {cliente}, seu atendimento com {profissional} será em {data} às {hora}.",
    bodyHtml:
      "<p>Olá <strong>{cliente}</strong>, serviço: {servico}. Link: <a href=\"{link}\">{link}</a></p>",
    isActive: false,
    createdAt: new Date("2026-06-22T10:00:00.000Z"),
    updatedAt: new Date("2026-06-22T10:00:00.000Z"),
    ...overrides,
  };
}

function buildContext(overrides = {}) {
  return {
    appPublicUrl: "http://localhost:5173",
    appointment: {
      startAt: new Date("2026-06-22T15:00:00.000Z"),
      client: {
        name: "Joao",
      },
      professional: {
        name: "Carlos",
      },
      service: {
        name: "Corte premium",
        durationMinutes: 30,
        price: "55.00",
      },
      ...overrides.appointment,
    },
    barbershopName: "AlphaMen Barbearia",
    ...overrides,
  };
}

function buildService(overrides = {}) {
  const calls = {
    activateReminderTemplate: [],
    countReminderTemplates: [],
    createReminderTemplate: [],
    createReminderTemplateWithActivation: [],
    deactivateReminderTemplate: [],
    findActiveReminderTemplate: [],
    findReminderTemplateById: [],
    loggerInfo: [],
    loggerWarn: [],
    listReminderTemplates: [],
    updateReminderTemplate: [],
    updateReminderTemplateWithActivation: [],
  };

  const deps = {
    async activateReminderTemplate(...args) {
      calls.activateReminderTemplate.push(args);
      return buildTemplate({ id: args[0], isActive: true });
    },
    async countReminderTemplates(...args) {
      calls.countReminderTemplates.push(args);
      return 1;
    },
    async createReminderTemplate(...args) {
      calls.createReminderTemplate.push(args);
      return buildTemplate({ ...args[0] });
    },
    async createReminderTemplateWithActivation(...args) {
      calls.createReminderTemplateWithActivation.push(args);
      return buildTemplate({ ...args[0], isActive: true });
    },
    async deactivateReminderTemplate(...args) {
      calls.deactivateReminderTemplate.push(args);
      return buildTemplate({ id: args[0], isActive: false });
    },
    async findActiveReminderTemplate(...args) {
      calls.findActiveReminderTemplate.push(args);
      return null;
    },
    async findReminderTemplateById(...args) {
      calls.findReminderTemplateById.push(args);
      return buildTemplate({ id: args[0] });
    },
    async listReminderTemplates(...args) {
      calls.listReminderTemplates.push(args);
      return [buildTemplate()];
    },
    async updateReminderTemplate(...args) {
      calls.updateReminderTemplate.push(args);
      return buildTemplate({ id: args[0], ...args[1] });
    },
    async updateReminderTemplateWithActivation(...args) {
      calls.updateReminderTemplateWithActivation.push(args);
      return buildTemplate({ id: args[0], ...args[2], isActive: true });
    },
    ...overrides,
  };

  return {
    calls,
    service: createReminderTemplateService({
      logger: {
        info(message, payload) {
          calls.loggerInfo.push([message, payload]);
        },
        warn(message, payload) {
          calls.loggerWarn.push([message, payload]);
        },
      },
      runtimeConfig: {
        appPublicUrl: "http://localhost:5173",
      },
      ...deps,
    }),
  };
}

test("ADMIN cria template válido", async () => {
  const { service, calls } = buildService();
  const actor = buildActor(ROLES.ADMIN);

  const result = await service.createTemplate(
    buildTemplate({
      id: undefined,
      isActive: false,
    }),
    actor,
  );

  assert.equal(result.name, "Lembrete padrao");
  assert.equal(calls.createReminderTemplate.length, 1);
});

test("rejeita placeholder desconhecido", async () => {
  const { service } = buildService();
  const actor = buildActor(ROLES.ADMIN);

  await assert.rejects(
    () =>
      service.createTemplate(
        buildTemplate({
          bodyText: "Olá {cliente}, código {desconhecido}.",
        }),
        actor,
      ),
    BadRequestError,
  );
});

test("rejeita HTML perigoso", async () => {
  const { service } = buildService();
  const actor = buildActor(ROLES.ADMIN);

  await assert.rejects(
    () =>
      service.createTemplate(
        buildTemplate({
          bodyHtml: "<img src=x onerror=alert(1) />",
        }),
        actor,
      ),
    BadRequestError,
  );
});

test("apenas um template ativo por type e channel usa caminho transacional", async () => {
  const { service, calls } = buildService();
  const actor = buildActor(ROLES.ADMIN);

  await service.createTemplate(
    buildTemplate({
      id: undefined,
      isActive: true,
    }),
    actor,
  );

  assert.equal(calls.createReminderTemplateWithActivation.length, 1);
  assert.equal(calls.createReminderTemplate.length, 0);
});

test("ativar um template usa o fluxo que desativa o anterior do mesmo type e channel", async () => {
  const { service, calls } = buildService();
  const actor = buildActor(ROLES.ADMIN);

  const result = await service.activateTemplate("template-1", actor);

  assert.equal(result.isActive, true);
  assert.deepEqual(calls.activateReminderTemplate[0], [
    "template-1",
    REMINDER_TEMPLATE_TYPES.APPOINTMENT_REMINDER,
    REMINDER_TEMPLATE_CHANNELS.EMAIL,
  ]);
});

test("renderiza placeholders permitidos corretamente", () => {
  const rendered = renderReminderTemplate(buildTemplate(), buildContext());

  assert.equal(rendered.subject, "Lembrete para Joao");
  assert.match(rendered.text, /Carlos/);
  assert.match(rendered.text, /22\/06\/2026/);
  assert.match(rendered.html, /Corte premium/);
});

test("escapa valores dinâmicos no HTML", () => {
  const rendered = renderReminderTemplate(
    buildTemplate(),
    buildContext({
      appointment: {
        client: {
          name: '<script>alert("x")</script>',
        },
      },
    }),
  );

  assert.match(rendered.html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
  assert.doesNotMatch(rendered.html, /<script>/);
});

test("usa fallback quando não há template ativo", async () => {
  const renderer = await getAppointmentReminderEmailRenderer({
    activeTemplate: null,
  });

  const rendered = renderer(buildContext());

  assert.match(rendered.subject, /AlphaMen Barbearia/);
  assert.match(rendered.text, /Joao/);
});

test("ADMIN consegue gerar preview com template ativo", async () => {
  const { service } = buildService({
    async findActiveReminderTemplate() {
      return buildTemplate();
    },
  });

  const result = await service.previewEmailTemplate(
    {
      type: REMINDER_TEMPLATE_TYPES.APPOINTMENT_REMINDER,
      channel: REMINDER_TEMPLATE_CHANNELS.EMAIL,
    },
    buildActor(ROLES.ADMIN),
  );

  assert.equal(result.fallbackUsed, false);
  assert.equal(result.placeholdersUsed.includes("{cliente}"), true);
  assert.match(result.subject, /João Silva/);
});

test("ADMIN consegue gerar preview com campos não salvos", async () => {
  const { service } = buildService();

  const result = await service.previewEmailTemplate(
    {
      type: REMINDER_TEMPLATE_TYPES.APPOINTMENT_REMINDER,
      channel: REMINDER_TEMPLATE_CHANNELS.EMAIL,
      subject: "Assunto {cliente}",
      bodyText: "Olá {cliente}, seu horário é às {hora}.",
      bodyHtml: "<p>Olá <strong>{cliente}</strong></p>",
    },
    buildActor(ROLES.ADMIN),
  );

  assert.equal(result.fallbackUsed, false);
  assert.equal(result.subject, "Assunto João Silva");
  assert.match(result.text, /14:30/);
});

test("preview rejeita placeholder inválido", async () => {
  const { service } = buildService();

  await assert.rejects(
    () =>
      service.previewEmailTemplate(
        {
          type: REMINDER_TEMPLATE_TYPES.APPOINTMENT_REMINDER,
          channel: REMINDER_TEMPLATE_CHANNELS.EMAIL,
          subject: "Assunto {cliente}",
          bodyText: "Código {invalido}",
        },
        buildActor(ROLES.ADMIN),
      ),
    BadRequestError,
  );
});

test("preview rejeita HTML perigoso", async () => {
  const { service } = buildService();

  await assert.rejects(
    () =>
      service.previewEmailTemplate(
        {
          type: REMINDER_TEMPLATE_TYPES.APPOINTMENT_REMINDER,
          channel: REMINDER_TEMPLATE_CHANNELS.EMAIL,
          subject: "Assunto {cliente}",
          bodyText: "Olá {cliente}",
          bodyHtml: "<img src=x onerror=alert(1) />",
        },
        buildActor(ROLES.ADMIN),
      ),
    BadRequestError,
  );
});

test("preview usa fallback quando não existe template ativo", async () => {
  const { service } = buildService({
    async findActiveReminderTemplate() {
      return null;
    },
  });

  const result = await service.previewEmailTemplate(
    {
      type: REMINDER_TEMPLATE_TYPES.APPOINTMENT_REMINDER,
      channel: REMINDER_TEMPLATE_CHANNELS.EMAIL,
    },
    buildActor(ROLES.ADMIN),
  );

  assert.equal(result.fallbackUsed, true);
  assert.match(result.subject, /Alphamen Barbearia/);
});

test("ADMIN consegue enviar teste com provider fake", async () => {
  const sentEmails = [];
  const { service, calls } = buildService({
    emailProvider: {
      async sendEmail(payload) {
        sentEmails.push(payload);
        return {
          provider: "fake",
          providerMessageId: "fake-email:test-1",
        };
      },
    },
    async findActiveReminderTemplate() {
      return buildTemplate({ isActive: true });
    },
  });

  const result = await service.sendTestEmail(
    {
      to: "admin@example.com",
      type: REMINDER_TEMPLATE_TYPES.APPOINTMENT_REMINDER,
      channel: REMINDER_TEMPLATE_CHANNELS.EMAIL,
    },
    buildActor(ROLES.ADMIN),
  );

  assert.equal(result.providerMessageId, "fake-email:test-1");
  assert.equal(sentEmails.length, 1);
  assert.equal(calls.createReminderTemplate.length, 0);
  assert.equal(calls.updateReminderTemplate.length, 0);
  assert.equal(calls.activateReminderTemplate.length, 0);
  assert.equal(calls.deactivateReminderTemplate.length, 0);
});

test("PROFESSIONAL não envia teste", async () => {
  const { service } = buildService();

  await assert.rejects(
    () =>
      service.sendTestEmail(
        {
          to: "admin@example.com",
          type: REMINDER_TEMPLATE_TYPES.APPOINTMENT_REMINDER,
          channel: REMINDER_TEMPLATE_CHANNELS.EMAIL,
        },
        buildActor(ROLES.PROFESSIONAL),
      ),
    ForbiddenError,
  );
});

test("CLIENT não envia teste", async () => {
  const { service } = buildService();

  await assert.rejects(
    () =>
      service.sendTestEmail(
        {
          to: "admin@example.com",
          type: REMINDER_TEMPLATE_TYPES.APPOINTMENT_REMINDER,
          channel: REMINDER_TEMPLATE_CHANNELS.EMAIL,
        },
        buildActor(ROLES.CLIENT),
      ),
    ForbiddenError,
  );
});

test("envio de teste rejeita e-mail inválido", async () => {
  const { service } = buildService();

  await assert.rejects(
    () =>
      service.sendTestEmail(
        {
          to: "admin@example.com,other@example.com",
          type: REMINDER_TEMPLATE_TYPES.APPOINTMENT_REMINDER,
          channel: REMINDER_TEMPLATE_CHANNELS.EMAIL,
        },
        buildActor(ROLES.ADMIN),
      ),
    BadRequestError,
  );
});

test("erro do provider retorna mensagem segura e não expõe segredo em logs", async () => {
  const { service, calls } = buildService({
    emailProvider: {
      async sendEmail() {
        throw new Error("provider failure secret-key-123");
      },
    },
    async findActiveReminderTemplate() {
      return buildTemplate({ isActive: true });
    },
  });

  await assert.rejects(
    () =>
      service.sendTestEmail(
        {
          to: "admin@example.com",
          type: REMINDER_TEMPLATE_TYPES.APPOINTMENT_REMINDER,
          channel: REMINDER_TEMPLATE_CHANNELS.EMAIL,
        },
        buildActor(ROLES.ADMIN),
      ),
    (error) => {
      assert.equal(error instanceof BadRequestError, true);
      assert.equal(error.message, "Não foi possível enviar o teste agora.");
      return true;
    },
  );

  assert.equal(calls.loggerWarn.length, 1);
  assert.doesNotMatch(String(calls.loggerWarn[0][1]), /secret-key-123/);
});

test("usa fallback quando template ativo está inválido", async () => {
  const warnings = [];
  const renderer = await getAppointmentReminderEmailRenderer({
    activeTemplate: buildTemplate({
      bodyHtml: "<script>alert(1)</script>",
    }),
    logger: {
      warn(message, payload) {
        warnings.push([message, payload]);
      },
    },
  });

  const rendered = renderer(buildContext());

  assert.match(rendered.subject, /AlphaMen Barbearia/);
  assert.equal(warnings.length, 1);
});

test("PROFESSIONAL não cria template", async () => {
  const { service } = buildService();

  await assert.rejects(
    () => service.createTemplate(buildTemplate(), buildActor(ROLES.PROFESSIONAL)),
    ForbiddenError,
  );
});

test("CLIENT não cria template", async () => {
  const { service } = buildService();

  await assert.rejects(
    () => service.createTemplate(buildTemplate(), buildActor(ROLES.CLIENT)),
    ForbiddenError,
  );
});

test("lista placeholders permitidos esperados", () => {
  assert.deepEqual(REMINDER_TEMPLATE_ALLOWED_PLACEHOLDERS, [
    "{cliente}",
    "{profissional}",
    "{servico}",
    "{data}",
    "{hora}",
    "{barbearia}",
    "{duracao}",
    "{preco}",
    "{link}",
  ]);
});
