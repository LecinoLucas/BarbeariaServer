import { z } from "zod";

import { env } from "../../config/env.js";
import { APPOINTMENT_STATUS } from "../../constants/appointmentStatus.js";
import { REMINDER_CHANNELS } from "../../constants/reminderChannel.js";
import { REMINDER_STATUSES } from "../../constants/reminderStatus.js";
import { ROLES } from "../../constants/roles.js";
import { USER_STATUS } from "../../constants/userStatus.js";
import { ForbiddenError } from "../../errors/ForbiddenError.js";
import { emitNotificationToUser } from "../../socket/socket.emitter.js";
import { createEmailProvider } from "../../providers/email/emailProviderFactory.js";
import { EmailProviderError } from "../../providers/email/emailProvider.js";
import { getAppointmentReminderEmailRenderer } from "../reminderTemplates/reminderTemplate.service.js";
import {
  cancelOutdatedReminders,
  cancelPendingRemindersByAppointmentId,
  cancelReminder,
  claimReminder,
  countReminders,
  createNotificationAndMarkSent,
  createReminder,
  findProfessionalByUserId,
  findReminderById,
  findReminderByIdempotencyKey,
  getReminderSettings,
  listDuePendingReminders,
  listReminders,
  markReminderAsSent,
  reactivateReminder,
  updateReminderAfterFailure,
} from "./appointmentReminder.repository.js";

const DEFAULT_REMINDER_MINUTES = 15;
const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BARBERSHOP_NAME = "AlphaMen Barbearia";
const REMINDABLE_STATUSES = new Set([
  APPOINTMENT_STATUS.SCHEDULED,
  APPOINTMENT_STATUS.CONFIRMED,
]);
const emailSchema = z.string().trim().email();

function parseReminderSettings(rows) {
  const values = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  const parsedMinutes = Number.parseInt(values.appointment_reminder_minutes ?? "", 10);

  return {
    enabled: values.appointment_reminder_enabled !== "false",
    emailChannelEnabled: values.appointment_reminder_email_enabled === "true",
    barbershopName: values.barbershop_name?.trim() || DEFAULT_BARBERSHOP_NAME,
    minutes:
      Number.isInteger(parsedMinutes) && parsedMinutes > 0
        ? parsedMinutes
        : DEFAULT_REMINDER_MINUTES,
  };
}

function isValidEmail(email) {
  return emailSchema.safeParse(email ?? "").success;
}

function isReminderEligible(appointment, config, now) {
  return Boolean(
    appointment &&
      !appointment.deletedAt &&
      config.enabled &&
      REMINDABLE_STATUSES.has(appointment.status) &&
      appointment.startAt > now,
  );
}

function buildScheduledAt(startAt, minutes) {
  return new Date(startAt.getTime() - minutes * 60 * 1000);
}

function buildIdempotencyKey({ appointmentId, channel, scheduledAt }) {
  return `appointment:${appointmentId}:reminder:${channel}:${scheduledAt.toISOString()}`;
}

function sanitizeErrorMessage(error) {
  if (error instanceof Error && error.message) {
    return error.message.slice(0, 500);
  }

  return "Falha ao processar lembrete de agendamento.";
}

function buildInAppMessage(reminder, minutes) {
  const clientName = reminder.appointment?.client?.name ?? "um cliente";

  return `O atendimento de ${clientName} começa em ${minutes} minuto(s).`;
}

function buildNotificationPayload(reminder) {
  return {
    reminderId: reminder.id,
    appointmentId: reminder.appointment.id,
    professionalId: reminder.appointment.professionalId,
    clientId: reminder.appointment.clientId,
    serviceId: reminder.appointment.serviceId,
    channel: reminder.channel,
    scheduledAt: reminder.scheduledAt,
    startAt: reminder.appointment.startAt,
  };
}

function buildReminderCreationInput(appointment, config, channel) {
  const scheduledAt = buildScheduledAt(appointment.startAt, config.minutes);

  return {
    appointmentId: appointment.id,
    channel,
    scheduledAt,
    maxAttempts: DEFAULT_MAX_ATTEMPTS,
    idempotencyKey: buildIdempotencyKey({
      appointmentId: appointment.id,
      channel,
      scheduledAt,
    }),
  };
}

function getEnabledChannels(appointment, config, runtimeConfig) {
  const channels = [REMINDER_CHANNELS.IN_APP];

  if (
    runtimeConfig.emailEnabled &&
    config.emailChannelEnabled &&
    isValidEmail(appointment.client?.email)
  ) {
    channels.push(REMINDER_CHANNELS.EMAIL);
  }

  return channels;
}

function isEmailChannelProcessable(config) {
  return config.emailChannelEnabled;
}

function buildLogPayload(reminder, details = {}) {
  return {
    appointmentId: reminder?.appointmentId ?? reminder?.appointment?.id ?? null,
    channel: reminder?.channel ?? null,
    providerMessageId: details.providerMessageId ?? null,
    reminderId: reminder?.id ?? null,
    status: details.status ?? null,
  };
}

function logReminder(details) {
  console.info("[appointment-reminder]", JSON.stringify(details));
}

export function createAppointmentReminderService(deps = {}) {
  const repository = {
    cancelOutdatedReminders: deps.cancelOutdatedReminders ?? cancelOutdatedReminders,
    cancelPendingRemindersByAppointmentId:
      deps.cancelPendingRemindersByAppointmentId ?? cancelPendingRemindersByAppointmentId,
    cancelReminder: deps.cancelReminder ?? cancelReminder,
    claimReminder: deps.claimReminder ?? claimReminder,
    createNotificationAndMarkSent:
      deps.createNotificationAndMarkSent ?? createNotificationAndMarkSent,
    createReminder: deps.createReminder ?? createReminder,
    findProfessionalByUserId: deps.findProfessionalByUserId ?? findProfessionalByUserId,
    findReminderById: deps.findReminderById ?? findReminderById,
    findReminderByIdempotencyKey:
      deps.findReminderByIdempotencyKey ?? findReminderByIdempotencyKey,
    getReminderSettings: deps.getReminderSettings ?? getReminderSettings,
    listDuePendingReminders: deps.listDuePendingReminders ?? listDuePendingReminders,
    listReminders: deps.listReminders ?? listReminders,
    markReminderAsSent: deps.markReminderAsSent ?? markReminderAsSent,
    countReminderRows: deps.countReminders ?? countReminders,
    reactivateReminder: deps.reactivateReminder ?? reactivateReminder,
    updateReminderAfterFailure: deps.updateReminderAfterFailure ?? updateReminderAfterFailure,
  };
  const notifyUser = deps.emitNotificationToUser ?? emitNotificationToUser;
  const emailProvider = deps.emailProvider ?? createEmailProvider();
  const runtimeConfig = {
    appPublicUrl: deps.runtimeConfig?.appPublicUrl ?? env.APP_PUBLIC_URL,
    emailEnabled: deps.runtimeConfig?.emailEnabled ?? env.EMAIL_ENABLED,
    emailReplyTo: deps.runtimeConfig?.emailReplyTo ?? env.EMAIL_REPLY_TO,
  };
  const resolveEmailRenderer =
    deps.getAppointmentReminderEmailRenderer ?? getAppointmentReminderEmailRenderer;

  async function getConfig() {
    const rows = await repository.getReminderSettings();
    return parseReminderSettings(rows);
  }

  async function syncReminderChannel(appointment, config, channel) {
    const reminderInput = buildReminderCreationInput(appointment, config, channel);

    await repository.cancelOutdatedReminders(
      appointment.id,
      channel,
      reminderInput.idempotencyKey,
    );

    const existingReminder = await repository.findReminderByIdempotencyKey(
      reminderInput.idempotencyKey,
    );

    if (!existingReminder) {
      return repository.createReminder(reminderInput);
    }

    if (
      existingReminder.status === REMINDER_STATUSES.CANCELED ||
      existingReminder.status === REMINDER_STATUSES.FAILED
    ) {
      return repository.reactivateReminder(existingReminder.id);
    }

    return existingReminder;
  }

  async function createReminderForAppointment(appointment, options = {}) {
    const now = options.now ?? new Date();
    const config = options.config ?? (await getConfig());

    if (!appointment?.id) {
      return [];
    }

    if (!isReminderEligible(appointment, config, now)) {
      await repository.cancelPendingRemindersByAppointmentId(
        appointment.id,
        "Lembrete cancelado por configuração ou status do agendamento.",
      );
      return [];
    }

    const channels = getEnabledChannels(appointment, config, runtimeConfig);
    const reminders = [];

    for (const channel of channels) {
      reminders.push(await syncReminderChannel(appointment, config, channel));
    }

    return reminders;
  }

  async function cancelReminderForAppointment(appointmentId) {
    if (!appointmentId) {
      return { count: 0 };
    }

    return repository.cancelPendingRemindersByAppointmentId(
      appointmentId,
      "Lembrete cancelado porque o agendamento foi cancelado.",
    );
  }

  async function recalculateReminderForAppointment(appointment, options = {}) {
    return createReminderForAppointment(appointment, options);
  }

  async function listDueReminders(now = new Date(), limit = DEFAULT_BATCH_SIZE) {
    return repository.listDuePendingReminders(now, limit);
  }

  async function handleReminderFailure(reminder, error) {
    const attempts = reminder.attempts + 1;
    const exhausted = attempts >= reminder.maxAttempts || error?.retryable === false;
    const finalStatus = exhausted ? REMINDER_STATUSES.FAILED : REMINDER_STATUSES.PENDING;

    await repository.updateReminderAfterFailure(reminder.id, {
      attempts,
      lastError: sanitizeErrorMessage(error),
      status: finalStatus,
    });

    return {
      finalStatus,
      providerMessageId: null,
      status: "failed",
    };
  }

  async function processInAppReminder(reminder, config) {
    const professionalUser = reminder.appointment.professional?.user;
    const professionalUserId = reminder.appointment.professional?.userId;

    if (
      !professionalUserId ||
      !professionalUser ||
      professionalUser.deletedAt ||
      professionalUser.status !== USER_STATUS.ACTIVE
    ) {
      return handleReminderFailure(
        reminder,
        new EmailProviderError("Profissional sem usuário ativo para receber lembrete interno.", {
          code: "REMINDER_IN_APP_DESTINATION_INVALID",
          retryable: false,
        }),
      );
    }

    const { notification } = await repository.createNotificationAndMarkSent(reminder.id, {
      userId: professionalUserId,
      title: "Atendimento em breve",
      message: buildInAppMessage(reminder, config.minutes),
      metadata: buildNotificationPayload(reminder),
    });

    notifyUser(notification.userId, notification);

    return {
      finalStatus: REMINDER_STATUSES.SENT,
      providerMessageId: null,
      status: "sent",
    };
  }

  async function processEmailReminder(reminder, config, renderEmailTemplate) {
    const email = reminder.appointment.client?.email?.trim();

    if (!isValidEmail(email)) {
      await repository.cancelReminder(reminder.id, "Cliente sem e-mail válido para lembrete.");

      return {
        finalStatus: REMINDER_STATUSES.CANCELED,
        providerMessageId: null,
        status: "ignored",
      };
    }

    const template = renderEmailTemplate({
      appPublicUrl: runtimeConfig.appPublicUrl,
      appointment: reminder.appointment,
      barbershopName: config.barbershopName,
    });

    const sendResult = await emailProvider.sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      replyTo: runtimeConfig.emailReplyTo || null,
      metadata: {
        appointmentId: reminder.appointment.id,
        channel: reminder.channel,
        idempotencyKey: reminder.idempotencyKey,
        reminderId: reminder.id,
      },
    });

    await repository.markReminderAsSent(reminder.id);

    return {
      finalStatus: REMINDER_STATUSES.SENT,
      providerMessageId: sendResult?.providerMessageId ?? null,
      status: "sent",
    };
  }

  async function processClaimedReminder(reminder, config, now, renderEmailTemplate) {
    if (!reminder?.appointment) {
      await repository.cancelReminder(reminder.id, "Agendamento não encontrado para o lembrete.");
      return {
        finalStatus: REMINDER_STATUSES.CANCELED,
        providerMessageId: null,
        status: "ignored",
      };
    }

    if (!isReminderEligible(reminder.appointment, config, now)) {
      await repository.cancelReminder(
        reminder.id,
        "Lembrete inválido após alteração de status, horário ou configuração.",
      );
      return {
        finalStatus: REMINDER_STATUSES.CANCELED,
        providerMessageId: null,
        status: "ignored",
      };
    }

    const expectedInput = buildReminderCreationInput(
      reminder.appointment,
      config,
      reminder.channel,
    );

    if (expectedInput.idempotencyKey !== reminder.idempotencyKey) {
      await repository.cancelReminder(
        reminder.id,
        "Lembrete substituído por uma versão mais recente do agendamento.",
      );
      return {
        finalStatus: REMINDER_STATUSES.CANCELED,
        providerMessageId: null,
        status: "ignored",
      };
    }

    if (reminder.channel === REMINDER_CHANNELS.IN_APP) {
      return processInAppReminder(reminder, config);
    }

    if (reminder.channel === REMINDER_CHANNELS.EMAIL) {
      if (!isEmailChannelProcessable(config)) {
        await repository.cancelReminder(
          reminder.id,
          "Lembrete de e-mail cancelado por configuração administrativa.",
        );
        return {
          finalStatus: REMINDER_STATUSES.CANCELED,
          providerMessageId: null,
          status: "ignored",
        };
      }

      return processEmailReminder(reminder, config, renderEmailTemplate);
    }

    return handleReminderFailure(
      reminder,
      new EmailProviderError("Canal de lembrete ainda não suportado.", {
        code: "REMINDER_CHANNEL_UNSUPPORTED",
        retryable: false,
      }),
    );
  }

  async function processAppointmentReminders(options = {}) {
    const now = options.now ?? new Date();
    const limit = options.limit ?? DEFAULT_BATCH_SIZE;
    const config = options.config ?? (await getConfig());
    const dueReminders = await listDueReminders(now, limit);
    const renderEmailTemplate =
      options.renderEmailTemplate ??
      (await resolveEmailRenderer({
        appPublicUrl: runtimeConfig.appPublicUrl,
        barbershopName: config.barbershopName,
      }));

    let processed = 0;
    let sent = 0;
    let failed = 0;
    let ignored = 0;

    for (const dueReminder of dueReminders) {
      const claimed = await repository.claimReminder(dueReminder.id);

      if (!claimed) {
        ignored += 1;
        continue;
      }

      const reminder = await repository.findReminderById(dueReminder.id);

      if (!reminder) {
        ignored += 1;
        continue;
      }

      processed += 1;

      try {
        const result = await processClaimedReminder(
          reminder,
          config,
          now,
          renderEmailTemplate,
        );

        if (result.status === "sent") {
          sent += 1;
        } else if (result.status === "failed") {
          failed += 1;
        } else {
          ignored += 1;
        }

        logReminder(buildLogPayload(reminder, {
          providerMessageId: result.providerMessageId,
          status: result.finalStatus,
        }));
      } catch (error) {
        const result = await handleReminderFailure(reminder, error);
        failed += 1;
        logReminder(buildLogPayload(reminder, {
          providerMessageId: null,
          status: result.finalStatus,
        }));
      }
    }

    return {
      processed,
      sent,
      failed,
      ignored,
    };
  }

  async function listAppointmentReminders(query, actor) {
    if (actor.role === ROLES.CLIENT) {
      throw new ForbiddenError("Acesso negado.");
    }

    const filters = {
      appointmentId: query.appointmentId,
      channel: query.channel,
      limit: query.limit,
      page: query.page,
      status: query.status,
    };

    if (actor.role === ROLES.PROFESSIONAL) {
      const professional = await repository.findProfessionalByUserId(actor.id);
      filters.professionalId = professional?.id ?? "none";
    }

    const [items, total] = await Promise.all([
      repository.listReminders(filters),
      repository.countReminderRows(filters),
    ]);

    return {
      items,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
      },
    };
  }

  return {
    cancelReminderForAppointment,
    createReminderForAppointment,
    getConfig,
    listAppointmentReminders,
    listDueReminders,
    processAppointmentReminders,
    recalculateReminderForAppointment,
  };
}

const appointmentReminderService = createAppointmentReminderService();

export const cancelReminderForAppointment =
  appointmentReminderService.cancelReminderForAppointment;
export const createReminderForAppointment =
  appointmentReminderService.createReminderForAppointment;
export const getAppointmentReminderConfig = appointmentReminderService.getConfig;
export const listAppointmentReminders =
  appointmentReminderService.listAppointmentReminders;
export const processAppointmentReminders =
  appointmentReminderService.processAppointmentReminders;
export const recalculateReminderForAppointment =
  appointmentReminderService.recalculateReminderForAppointment;
export { buildIdempotencyKey, buildReminderCreationInput, parseReminderSettings };
