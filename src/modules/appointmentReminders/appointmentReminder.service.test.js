import assert from "node:assert/strict";
import test from "node:test";

import { APPOINTMENT_STATUS } from "../../constants/appointmentStatus.js";
import { REMINDER_CHANNELS } from "../../constants/reminderChannel.js";
import { REMINDER_STATUSES } from "../../constants/reminderStatus.js";
import { ROLES } from "../../constants/roles.js";
import { USER_STATUS } from "../../constants/userStatus.js";
import { ForbiddenError } from "../../errors/ForbiddenError.js";
import { EmailProviderError } from "../../providers/email/emailProvider.js";
import { createAppointmentReminderService } from "./appointmentReminder.service.js";

function buildAppointment(overrides = {}) {
  return {
    id: "appointment-1",
    clientId: "client-1",
    professionalId: "professional-1",
    serviceId: "service-1",
    startAt: new Date("2026-06-22T15:00:00.000Z"),
    endAt: new Date("2026-06-22T15:30:00.000Z"),
    status: APPOINTMENT_STATUS.SCHEDULED,
    deletedAt: null,
    client: {
      id: "client-1",
      name: "Joao",
      email: "joao@example.com",
    },
    professional: {
      id: "professional-1",
      userId: "user-professional-1",
      name: "Carlos",
      user: {
        id: "user-professional-1",
        status: USER_STATUS.ACTIVE,
        deletedAt: null,
      },
    },
    service: {
      id: "service-1",
      name: "Corte",
      durationMinutes: 30,
      price: "55.00",
    },
    ...overrides,
  };
}

function buildReminder(overrides = {}) {
  const appointment = overrides.appointment ?? buildAppointment();
  const channel = overrides.channel ?? REMINDER_CHANNELS.IN_APP;
  const scheduledAt = overrides.scheduledAt ?? new Date("2026-06-22T14:45:00.000Z");

  return {
    id: overrides.id ?? "reminder-1",
    appointmentId: appointment.id,
    channel,
    scheduledAt,
    status: overrides.status ?? REMINDER_STATUSES.PROCESSING,
    sentAt: null,
    attempts: overrides.attempts ?? 0,
    maxAttempts: overrides.maxAttempts ?? 3,
    lastError: null,
    idempotencyKey:
      overrides.idempotencyKey ??
      `appointment:${appointment.id}:reminder:${channel}:${scheduledAt.toISOString()}`,
    createdAt: new Date("2026-06-22T10:00:00.000Z"),
    updatedAt: new Date("2026-06-22T10:00:00.000Z"),
    appointment,
    ...overrides,
  };
}

function buildSettings(overrides = []) {
  return [
    { key: "barbershop_name", value: "AlphaMen Barbearia" },
    { key: "appointment_reminder_enabled", value: "true" },
    { key: "appointment_reminder_email_enabled", value: "false" },
    { key: "appointment_reminder_minutes", value: "15" },
    ...overrides,
  ];
}

function buildService(overrides = {}) {
  const calls = {
    cancelOutdatedReminders: [],
    cancelPendingRemindersByAppointmentId: [],
    cancelReminder: [],
    claimReminder: [],
    countReminders: [],
    createNotificationAndMarkSent: [],
    createReminder: [],
    emitNotificationToUser: [],
    emailProviderSendEmail: [],
    findProfessionalByUserId: [],
    findReminderById: [],
    findReminderByIdempotencyKey: [],
    getReminderSettings: 0,
    getAppointmentReminderEmailRenderer: [],
    listDuePendingReminders: [],
    listReminders: [],
    markReminderAsSent: [],
    reactivateReminder: [],
    updateReminderAfterFailure: [],
  };

  const deps = {
    async cancelOutdatedReminders(...args) {
      calls.cancelOutdatedReminders.push(args);
      return { count: 0 };
    },
    async cancelPendingRemindersByAppointmentId(...args) {
      calls.cancelPendingRemindersByAppointmentId.push(args);
      return { count: 1 };
    },
    async cancelReminder(...args) {
      calls.cancelReminder.push(args);
      return null;
    },
    async claimReminder(...args) {
      calls.claimReminder.push(args);
      return true;
    },
    async countReminders(...args) {
      calls.countReminders.push(args);
      return 1;
    },
    async createNotificationAndMarkSent(...args) {
      calls.createNotificationAndMarkSent.push(args);
      return {
        notification: {
          id: "notification-1",
          userId: "user-professional-1",
          title: "Atendimento em breve",
          message: "Mensagem",
          type: "APPOINTMENT_REMINDER",
          readAt: null,
          metadata: null,
          createdAt: new Date("2026-06-22T14:45:00.000Z"),
          updatedAt: new Date("2026-06-22T14:45:00.000Z"),
        },
      };
    },
    async createReminder(...args) {
      calls.createReminder.push(args);
      return {
        id: `reminder-created-${calls.createReminder.length}`,
        ...args[0],
      };
    },
    emitNotificationToUser(...args) {
      calls.emitNotificationToUser.push(args);
    },
    emailProvider: {
      async sendEmail(...args) {
        calls.emailProviderSendEmail.push(args);
        return {
          provider: "fake",
          providerMessageId: `fake-email:${args[0].metadata.idempotencyKey}`,
        };
      },
    },
    async findProfessionalByUserId(...args) {
      calls.findProfessionalByUserId.push(args);
      return { id: "professional-1", userId: "user-professional-1" };
    },
    async findReminderById(...args) {
      calls.findReminderById.push(args);
      return buildReminder();
    },
    async findReminderByIdempotencyKey(...args) {
      calls.findReminderByIdempotencyKey.push(args);
      return null;
    },
    async getReminderSettings() {
      calls.getReminderSettings += 1;
      return buildSettings();
    },
    async getAppointmentReminderEmailRenderer(...args) {
      calls.getAppointmentReminderEmailRenderer.push(args);
      return ({ appointment, barbershopName }) => ({
        subject: `Lembrete ${barbershopName}`,
        html: `<p>${appointment.client.name}</p>`,
        text: `Cliente ${appointment.client.name}`,
      });
    },
    async listDuePendingReminders(...args) {
      calls.listDuePendingReminders.push(args);
      return [{ id: "reminder-1" }];
    },
    async listReminders(...args) {
      calls.listReminders.push(args);
      return [{ id: "reminder-1" }];
    },
    async markReminderAsSent(...args) {
      calls.markReminderAsSent.push(args);
      return null;
    },
    runtimeConfig: {
      appPublicUrl: "http://localhost:5173",
      emailEnabled: false,
      emailReplyTo: "suporte@alphamen.com",
    },
    async reactivateReminder(...args) {
      calls.reactivateReminder.push(args);
      return { id: args[0], status: REMINDER_STATUSES.PENDING };
    },
    async updateReminderAfterFailure(...args) {
      calls.updateReminderAfterFailure.push(args);
      return null;
    },
    ...overrides,
  };

  return {
    calls,
    service: createAppointmentReminderService(deps),
  };
}

test("cria lembrete IN_APP ao sincronizar novo agendamento elegível", async () => {
  const { service, calls } = buildService();
  const appointment = buildAppointment();

  const reminders = await service.createReminderForAppointment(appointment, {
    now: new Date("2026-06-22T14:00:00.000Z"),
  });

  assert.equal(reminders.length, 1);
  assert.equal(reminders[0].channel, REMINDER_CHANNELS.IN_APP);
  assert.equal(calls.createReminder.length, 1);
  assert.deepEqual(calls.cancelOutdatedReminders[0], [
    appointment.id,
    REMINDER_CHANNELS.IN_APP,
    "appointment:appointment-1:reminder:IN_APP:2026-06-22T14:45:00.000Z",
  ]);
});

test("cria lembrete EMAIL quando EMAIL_ENABLED=true e cliente tem e-mail", async () => {
  const { service, calls } = buildService({
    async getReminderSettings() {
      calls.getReminderSettings += 1;
      return buildSettings([
        { key: "appointment_reminder_email_enabled", value: "true" },
      ]);
    },
    runtimeConfig: {
      appPublicUrl: "http://localhost:5173",
      emailEnabled: true,
      emailReplyTo: "suporte@alphamen.com",
    },
  });

  const reminders = await service.createReminderForAppointment(buildAppointment(), {
    now: new Date("2026-06-22T14:00:00.000Z"),
  });

  assert.equal(reminders.length, 2);
  assert.deepEqual(
    reminders.map((item) => item.channel).sort(),
    [REMINDER_CHANNELS.EMAIL, REMINDER_CHANNELS.IN_APP],
  );
  assert.equal(
    calls.createReminder[1][0].idempotencyKey,
    "appointment:appointment-1:reminder:EMAIL:2026-06-22T14:45:00.000Z",
  );
});

test("não cria lembrete EMAIL quando EMAIL_ENABLED=false", async () => {
  const { service } = buildService({
    async getReminderSettings() {
      return buildSettings([
        { key: "appointment_reminder_email_enabled", value: "true" },
      ]);
    },
  });

  const reminders = await service.createReminderForAppointment(buildAppointment(), {
    now: new Date("2026-06-22T14:00:00.000Z"),
  });

  assert.equal(reminders.length, 1);
  assert.equal(reminders[0].channel, REMINDER_CHANNELS.IN_APP);
});

test("não cria lembrete EMAIL quando cliente não tem e-mail", async () => {
  const { service } = buildService({
    async getReminderSettings() {
      return buildSettings([
        { key: "appointment_reminder_email_enabled", value: "true" },
      ]);
    },
    runtimeConfig: {
      appPublicUrl: "http://localhost:5173",
      emailEnabled: true,
      emailReplyTo: "suporte@alphamen.com",
    },
  });

  const reminders = await service.createReminderForAppointment(
    buildAppointment({
      client: {
        id: "client-1",
        name: "Joao",
        email: "",
      },
    }),
    {
      now: new Date("2026-06-22T14:00:00.000Z"),
    },
  );

  assert.equal(reminders.length, 1);
  assert.equal(reminders[0].channel, REMINDER_CHANNELS.IN_APP);
});

test("cancela lembrete pendente ao cancelar agendamento", async () => {
  const { service, calls } = buildService();

  await service.cancelReminderForAppointment("appointment-1");

  assert.deepEqual(calls.cancelPendingRemindersByAppointmentId[0], [
    "appointment-1",
    "Lembrete cancelado porque o agendamento foi cancelado.",
  ]);
});

test("recalcula lembretes ao reagendar atendimento", async () => {
  const { service, calls } = buildService({
    async getReminderSettings() {
      calls.getReminderSettings += 1;
      return buildSettings([
        { key: "appointment_reminder_email_enabled", value: "true" },
      ]);
    },
    runtimeConfig: {
      appPublicUrl: "http://localhost:5173",
      emailEnabled: true,
      emailReplyTo: "suporte@alphamen.com",
    },
  });

  const reminders = await service.recalculateReminderForAppointment(
    buildAppointment({
      startAt: new Date("2026-06-22T16:00:00.000Z"),
      endAt: new Date("2026-06-22T16:30:00.000Z"),
    }),
    {
      now: new Date("2026-06-22T14:00:00.000Z"),
    },
  );

  assert.equal(reminders.length, 2);
  assert.equal(
    calls.findReminderByIdempotencyKey[1][0],
    "appointment:appointment-1:reminder:EMAIL:2026-06-22T15:45:00.000Z",
  );
});

test("job processa EMAIL com provider fake e marca SENT", async () => {
  const emailReminder = buildReminder({
    channel: REMINDER_CHANNELS.EMAIL,
    appointment: buildAppointment(),
  });

  const { service, calls } = buildService({
    async getReminderSettings() {
      calls.getReminderSettings += 1;
      return buildSettings([
        { key: "appointment_reminder_email_enabled", value: "true" },
      ]);
    },
    async findReminderById(...args) {
      calls.findReminderById.push(args);
      return emailReminder;
    },
    runtimeConfig: {
      appPublicUrl: "http://localhost:5173",
      emailEnabled: true,
      emailReplyTo: "suporte@alphamen.com",
    },
  });

  const result = await service.processAppointmentReminders({
    now: new Date("2026-06-22T14:50:00.000Z"),
    limit: 50,
  });

  assert.deepEqual(result, {
    processed: 1,
    sent: 1,
    failed: 0,
    ignored: 0,
  });
  assert.equal(calls.emailProviderSendEmail.length, 1);
  assert.equal(calls.markReminderAsSent.length, 1);
  assert.equal(calls.getAppointmentReminderEmailRenderer.length, 1);
  assert.equal(calls.emailProviderSendEmail[0][0].subject, "Lembrete AlphaMen Barbearia");
});

test("job marca FAILED ao esgotar attempts no EMAIL", async () => {
  const emailReminder = buildReminder({
    channel: REMINDER_CHANNELS.EMAIL,
    attempts: 2,
    maxAttempts: 3,
  });

  const { service, calls } = buildService({
    emailProvider: {
      async sendEmail() {
        throw new EmailProviderError("Falha controlada.", {
          code: "EMAIL_SEND_FAILED",
          retryable: true,
        });
      },
    },
    async findReminderById(...args) {
      calls.findReminderById.push(args);
      return emailReminder;
    },
    async getReminderSettings() {
      calls.getReminderSettings += 1;
      return buildSettings([
        { key: "appointment_reminder_email_enabled", value: "true" },
      ]);
    },
    runtimeConfig: {
      appPublicUrl: "http://localhost:5173",
      emailEnabled: true,
      emailReplyTo: "suporte@alphamen.com",
    },
  });

  const result = await service.processAppointmentReminders({
    now: new Date("2026-06-22T14:50:00.000Z"),
    limit: 50,
  });

  assert.deepEqual(result, {
    processed: 1,
    sent: 0,
    failed: 1,
    ignored: 0,
  });
  assert.deepEqual(calls.updateReminderAfterFailure[0][1], {
    attempts: 3,
    lastError: "Falha controlada.",
    status: REMINDER_STATUSES.FAILED,
  });
});

test("erro no EMAIL não quebra IN_APP", async () => {
  const inAppReminder = buildReminder({
    id: "reminder-in-app",
    channel: REMINDER_CHANNELS.IN_APP,
  });
  const emailReminder = buildReminder({
    id: "reminder-email",
    channel: REMINDER_CHANNELS.EMAIL,
  });

  const { service, calls } = buildService({
    emailProvider: {
      async sendEmail() {
        throw new EmailProviderError("Falha no e-mail.", {
          code: "EMAIL_SEND_FAILED",
          retryable: true,
        });
      },
    },
    async listDuePendingReminders(...args) {
      calls.listDuePendingReminders.push(args);
      return [{ id: "reminder-email" }, { id: "reminder-in-app" }];
    },
    async findReminderById(id) {
      calls.findReminderById.push([id]);
      return id === "reminder-email" ? emailReminder : inAppReminder;
    },
    async getReminderSettings() {
      calls.getReminderSettings += 1;
      return buildSettings([
        { key: "appointment_reminder_email_enabled", value: "true" },
      ]);
    },
    runtimeConfig: {
      appPublicUrl: "http://localhost:5173",
      emailEnabled: true,
      emailReplyTo: "suporte@alphamen.com",
    },
  });

  const result = await service.processAppointmentReminders({
    now: new Date("2026-06-22T14:50:00.000Z"),
    limit: 50,
  });

  assert.deepEqual(result, {
    processed: 2,
    sent: 1,
    failed: 1,
    ignored: 0,
  });
  assert.equal(calls.createNotificationAndMarkSent.length, 1);
  assert.equal(calls.updateReminderAfterFailure.length, 1);
});

test("idempotencyKey é única por canal", () => {
  const inAppReminder = buildReminder({
    channel: REMINDER_CHANNELS.IN_APP,
  });
  const emailReminder = buildReminder({
    channel: REMINDER_CHANNELS.EMAIL,
  });

  assert.notEqual(inAppReminder.idempotencyKey, emailReminder.idempotencyKey);
});

test("integração do lembrete EMAIL usa template customizado quando ativo", async () => {
  const emailReminder = buildReminder({
    channel: REMINDER_CHANNELS.EMAIL,
    appointment: buildAppointment(),
  });

  const { service, calls } = buildService({
    async getReminderSettings() {
      calls.getReminderSettings += 1;
      return buildSettings([
        { key: "appointment_reminder_email_enabled", value: "true" },
      ]);
    },
    async findReminderById(...args) {
      calls.findReminderById.push(args);
      return emailReminder;
    },
    async getAppointmentReminderEmailRenderer(...args) {
      calls.getAppointmentReminderEmailRenderer.push(args);
      return ({ appointment }) => ({
        subject: `Custom ${appointment.client.name}`,
        html: "<p>custom</p>",
        text: `Custom ${appointment.client.name}`,
      });
    },
    runtimeConfig: {
      appPublicUrl: "http://localhost:5173",
      emailEnabled: true,
      emailReplyTo: "suporte@alphamen.com",
    },
  });

  await service.processAppointmentReminders({
    now: new Date("2026-06-22T14:50:00.000Z"),
    limit: 50,
  });

  assert.equal(calls.emailProviderSendEmail[0][0].subject, "Custom Joao");
  assert.equal(calls.emailProviderSendEmail[0][0].text, "Custom Joao");
});

test("job não envia duplicado quando o lembrete já foi claimado", async () => {
  const { service, calls } = buildService({
    async claimReminder() {
      return false;
    },
  });

  const result = await service.processAppointmentReminders({
    now: new Date("2026-06-22T14:50:00.000Z"),
    limit: 50,
  });

  assert.deepEqual(result, {
    processed: 0,
    sent: 0,
    failed: 0,
    ignored: 1,
  });
  assert.equal(calls.createNotificationAndMarkSent.length, 0);
  assert.equal(calls.emailProviderSendEmail.length, 0);
});

test("profissional lista apenas os próprios lembretes", async () => {
  const { service, calls } = buildService();

  const result = await service.listAppointmentReminders(
    { page: 1, limit: 10 },
    { id: "user-professional-1", role: ROLES.PROFESSIONAL },
  );

  assert.equal(result.items.length, 1);
  assert.equal(calls.listReminders[0][0].professionalId, "professional-1");
});

test("cliente não acessa listagem de lembretes", async () => {
  const { service } = buildService();

  await assert.rejects(
    () =>
      service.listAppointmentReminders(
        { page: 1, limit: 10 },
        { id: "user-client-1", role: ROLES.CLIENT },
      ),
    ForbiddenError,
  );
});

test("admin acessa listagem sem filtro de profissional", async () => {
  const { service, calls } = buildService();

  const result = await service.listAppointmentReminders(
    { page: 1, limit: 10 },
    { id: "user-admin-1", role: ROLES.ADMIN },
  );

  assert.equal(result.items.length, 1);
  assert.equal(calls.listReminders[0][0].professionalId, undefined);
});
