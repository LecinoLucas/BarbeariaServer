import assert from "node:assert/strict";
import test from "node:test";

import { ValidationError } from "../../errors/ValidationError.js";
import {
  CLIENT_PORTAL_DEFAULTS,
  LOGIN_APPEARANCE_DEFAULTS,
  createSettingsService,
} from "./settings.service.js";
import { validateLoginAppearance, validateSettings } from "./settings.validator.js";
import { validatePublicPortalSettings } from "./publicPortal.validator.js";

function buildSettingRow(key, value, updatedAt = "2026-06-23T12:00:00.000Z") {
  return {
    id: `${key}-id`,
    key,
    value,
    createdAt: new Date(updatedAt),
    updatedAt: new Date(updatedAt),
  };
}

function createServiceHarness(overrides = {}) {
  const calls = {
    getMany: [],
    upsertMany: [],
    ensureStorageDir: 0,
    removeStoredBackgroundImage: [],
    writeFile: [],
  };

  const service = createSettingsService({
    async getMany(keys) {
      calls.getMany.push(keys);
      return overrides.getManyResult ?? [];
    },
    async upsertMany(pairs) {
      calls.upsertMany.push(pairs);
      return pairs;
    },
    async ensureStorageDir() {
      calls.ensureStorageDir += 1;
    },
    async removeStoredBackgroundImage(url) {
      calls.removeStoredBackgroundImage.push(url);
    },
    async writeFile(filePath, body) {
      calls.writeFile.push({ filePath, body });
    },
    ...overrides,
  });

  return { calls, service };
}

test("getLoginAppearance usa fallback quando não há configuração", async () => {
  const { service } = createServiceHarness();

  const result = await service.getLoginAppearance();

  assert.deepEqual(result, LOGIN_APPEARANCE_DEFAULTS);
});

test("updateLoginAppearance persiste opcionais como vazio e reaplica fallback público", async () => {
  const { service, calls } = createServiceHarness({
    getManyResult: [
      buildSettingRow("login_appearance_hero_title", "Título atual"),
      buildSettingRow("login_appearance_background_image_url", "/login-appearance-assets/hero.jpg"),
    ],
  });

  await service.updateLoginAppearance({
    heroTitle: "Novo título",
    heroSubtitle: null,
    heroEyebrow: null,
    loginButtonText: null,
    backgroundImageUrl: null,
    backgroundImageAlt: null,
  });

  assert.equal(calls.upsertMany.length, 1);
  assert.deepEqual(calls.upsertMany[0], [
    { key: "login_appearance_hero_title", value: "Novo título" },
    { key: "login_appearance_hero_subtitle", value: "" },
    { key: "login_appearance_hero_eyebrow", value: "" },
    { key: "login_appearance_button_text", value: "" },
    {
      key: "login_appearance_background_image_url",
      value: "/login-appearance-assets/hero.jpg",
    },
    { key: "login_appearance_background_image_alt", value: "" },
  ]);
});

test("getSettings usa default seguro quando receipt_template está ausente", async () => {
  const { service } = createServiceHarness({
    getManyResult: [
      buildSettingRow("barbershop_name", "AlphaMen"),
      buildSettingRow("default_open_time", "09:00"),
      buildSettingRow("default_close_time", "18:00"),
      buildSettingRow("appointment_interval_minutes", "5"),
      buildSettingRow("appointment_reminder_minutes", "15"),
      buildSettingRow("allow_client_cancel", "true"),
      buildSettingRow("allow_client_reschedule", "true"),
    ],
  });

  const result = await service.getSettings();

  assert.equal(result.receiptTemplate, "classic");
  assert.equal(result.clientPortalEnabled, true);
  assert.equal(result.clientPortalSelfSignupEnabled, true);
  assert.equal(result.clientPortalRequireAdminApproval, false);
  assert.equal(result.clientPortalGoogleLoginEnabled, false);
  assert.equal(result.clientPortalCancelMinHours, 0);
  assert.equal(result.clientPortalSupportLabel, "Fale com a barbearia");
  assert.equal(result.clientPortalBookingMinHoursAdvance, 0);
  assert.equal(result.clientPortalBookingMaxDaysAhead, 30);
  assert.equal(result.clientPortalMaxActiveAppointments, 1);
  assert.equal(result.clientPortalNotesEnabled, true);
  assert.equal(result.clientPortalNotesRequired, false);
  assert.equal(
    result.clientPortalBookingInstruction,
    "Confira os dados antes de confirmar seu agendamento.",
  );
  assert.equal(result.clientPortalDashboardShowLastVisit, true);
  assert.equal(result.clientPortalDashboardShowTotalAppointments, true);
  assert.equal(result.clientPortalDashboardShowMonthCount, true);
  assert.equal(result.clientPortalDashboardShowNextAppointment, true);
  assert.equal(result.clientPortalDashboardShowRecentHistory, true);
  assert.equal(result.clientPortalDashboardHistoryLimit, 5);
  assert.equal(result.clientPortalAppointmentsShowHistory, true);
  assert.equal(result.clientPortalAppointmentsHistoryLimit, 20);
  assert.equal(
    result.clientPortalEmptyDashboardMessage,
    "Você ainda não possui histórico de agendamentos.",
  );
  assert.equal(
    result.clientPortalEmptyAppointmentsMessage,
    "Você ainda não possui agendamentos.",
  );
});

test("getClientPortalSettings retorna defaults das novas chaves", async () => {
  const { service } = createServiceHarness();

  const result = await service.getClientPortalSettings();

  assert.deepEqual(result, CLIENT_PORTAL_DEFAULTS);
});

test("getClientPortalSettings usa WhatsApp da barbearia como fallback do link de suporte", async () => {
  const { service } = createServiceHarness({
    getManyResult: [
      buildSettingRow("barbershop_whatsapp", "(11) 99999-8888"),
    ],
  });

  const result = await service.getClientPortalSettings();

  assert.equal(result.supportUrl, "https://wa.me/11999998888");
});

test("getClientPortalSettings retorna regras avançadas configuradas", async () => {
  const { service } = createServiceHarness({
    getManyResult: [
      buildSettingRow("client_portal_self_signup_enabled", "false"),
      buildSettingRow("client_portal_require_admin_approval", "true"),
      buildSettingRow("client_portal_google_login_enabled", "true"),
      buildSettingRow("client_portal_booking_min_hours_advance", "2"),
      buildSettingRow("client_portal_booking_max_days_ahead", "45"),
      buildSettingRow("client_portal_max_active_appointments", "3"),
      buildSettingRow("client_portal_notes_enabled", "false"),
      buildSettingRow("client_portal_notes_required", "true"),
      buildSettingRow("client_portal_booking_instruction", "Revise tudo antes de confirmar."),
      buildSettingRow("client_portal_dashboard_show_last_visit", "false"),
      buildSettingRow("client_portal_dashboard_history_limit", "8"),
      buildSettingRow("client_portal_appointments_show_history", "false"),
      buildSettingRow("client_portal_appointments_history_limit", "12"),
      buildSettingRow(
        "client_portal_empty_dashboard_message",
        "Sem histórico para mostrar.",
      ),
      buildSettingRow(
        "client_portal_empty_appointments_message",
        "Sem agendamentos para mostrar.",
      ),
    ],
  });

  const result = await service.getClientPortalSettings();

  assert.equal(result.selfSignupEnabled, false);
  assert.equal(result.requireAdminApproval, true);
  assert.equal(result.googleLoginEnabled, true);
  assert.equal(result.bookingMinHoursAdvance, 2);
  assert.equal(result.bookingMaxDaysAhead, 45);
  assert.equal(result.maxActiveAppointments, 3);
  assert.equal(result.notesEnabled, false);
  assert.equal(result.notesRequired, false);
  assert.equal(result.bookingInstruction, "Revise tudo antes de confirmar.");
  assert.equal(result.dashboardShowLastVisit, false);
  assert.equal(result.dashboardHistoryLimit, 8);
  assert.equal(result.appointmentsShowHistory, false);
  assert.equal(result.appointmentsHistoryLimit, 12);
  assert.equal(result.emptyDashboardMessage, "Sem histórico para mostrar.");
  assert.equal(result.emptyAppointmentsMessage, "Sem agendamentos para mostrar.");
});

test("getSettings normaliza valor legado do modelo 2", async () => {
  const { service } = createServiceHarness({
    getManyResult: [
      buildSettingRow("receipt_template", "model_2"),
    ],
  });

  const result = await service.getSettings();

  assert.equal(result.receiptTemplate, "clean_compact");
});

test("updateSettings persiste receiptTemplate classic", async () => {
  let savedPairs = [];
  const { service, calls } = createServiceHarness({
    async upsertMany(pairs) {
      savedPairs = pairs;
      calls.upsertMany.push(pairs);
      return pairs;
    },
    async getMany(keys) {
      calls.getMany.push(keys);
      return savedPairs.map(({ key, value }) => buildSettingRow(key, value));
    },
  });

  const result = await service.updateSettings({
    barbershopName: "AlphaMen",
    phone: "",
    whatsapp: "",
    instagram: "",
    email: "",
    address: {
      street: "",
      number: "",
      district: "",
      city: "",
      state: "",
      zipcode: "",
    },
    appointmentReminderEnabled: true,
    appointmentReminderEmailEnabled: false,
    appointmentReminderMinutes: 15,
    defaultOpenTime: "09:00",
    defaultCloseTime: "18:00",
    appointmentIntervalMinutes: 5,
    allowClientCancel: true,
    allowClientReschedule: true,
    clientPortalEnabled: true,
    clientPortalSelfSignupEnabled: false,
    clientPortalRequireAdminApproval: true,
    clientPortalGoogleLoginEnabled: true,
    clientPortalBookingEnabled: true,
    clientPortalCancelEnabled: true,
    clientPortalCancelMinHours: 2,
    clientPortalShowPrices: true,
    clientPortalShowDuration: true,
    clientPortalShowProfessional: true,
    clientPortalSupportLabel: "Fale com a equipe",
    clientPortalSupportUrl: "https://wa.me/5511999999999",
    clientPortalBookingSuccessMessage: "Agendamento confirmado.",
    clientPortalNoSlotsMessage: "Sem horários disponíveis.",
    clientPortalBookingMinHoursAdvance: 2,
    clientPortalBookingMaxDaysAhead: 45,
    clientPortalMaxActiveAppointments: 3,
    clientPortalNotesEnabled: true,
    clientPortalNotesRequired: true,
    clientPortalBookingInstruction: "Revise tudo antes de confirmar.",
    clientPortalDashboardShowLastVisit: true,
    clientPortalDashboardShowTotalAppointments: true,
    clientPortalDashboardShowMonthCount: true,
    clientPortalDashboardShowNextAppointment: true,
    clientPortalDashboardShowRecentHistory: true,
    clientPortalDashboardHistoryLimit: 8,
    clientPortalAppointmentsShowHistory: true,
    clientPortalAppointmentsHistoryLimit: 40,
    clientPortalEmptyDashboardMessage: "Sem histórico para mostrar.",
    clientPortalEmptyAppointmentsMessage: "Sem agendamentos para mostrar.",
    receiptTemplate: "classic",
  });

  assert.equal(
    calls.upsertMany[0].find((entry) => entry.key === "client_portal_self_signup_enabled")?.value,
    "false",
  );
  assert.equal(
    calls.upsertMany[0].find((entry) => entry.key === "client_portal_require_admin_approval")
      ?.value,
    "true",
  );
  assert.equal(
    calls.upsertMany[0].find((entry) => entry.key === "client_portal_google_login_enabled")
      ?.value,
    "true",
  );
  assert.equal(
    calls.upsertMany[0].find((entry) => entry.key === "receipt_template")?.value,
    "classic",
  );
  assert.equal(
    calls.upsertMany[0].find((entry) => entry.key === "client_portal_cancel_min_hours")?.value,
    "2",
  );
  assert.equal(
    calls.upsertMany[0].find((entry) => entry.key === "client_portal_booking_min_hours_advance")
      ?.value,
    "2",
  );
  assert.equal(
    calls.upsertMany[0].find((entry) => entry.key === "client_portal_notes_required")?.value,
    "true",
  );
  assert.equal(
    calls.upsertMany[0].find((entry) => entry.key === "client_portal_dashboard_history_limit")
      ?.value,
    "8",
  );
  assert.equal(result.receiptTemplate, "classic");
});

test("updateSettings persiste receiptTemplate clean_compact", async () => {
  let savedPairs = [];
  const { service, calls } = createServiceHarness({
    async upsertMany(pairs) {
      savedPairs = pairs;
      calls.upsertMany.push(pairs);
      return pairs;
    },
    async getMany(keys) {
      calls.getMany.push(keys);
      return savedPairs.map(({ key, value }) => buildSettingRow(key, value));
    },
  });

  const result = await service.updateSettings({
    barbershopName: "AlphaMen",
    phone: "",
    whatsapp: "",
    instagram: "",
    email: "",
    address: {
      street: "",
      number: "",
      district: "",
      city: "",
      state: "",
      zipcode: "",
    },
    appointmentReminderEnabled: true,
    appointmentReminderEmailEnabled: false,
    appointmentReminderMinutes: 15,
    defaultOpenTime: "09:00",
    defaultCloseTime: "18:00",
    appointmentIntervalMinutes: 5,
    allowClientCancel: true,
    allowClientReschedule: true,
    clientPortalEnabled: true,
    clientPortalSelfSignupEnabled: true,
    clientPortalRequireAdminApproval: false,
    clientPortalGoogleLoginEnabled: false,
    clientPortalBookingEnabled: true,
    clientPortalCancelEnabled: true,
    clientPortalCancelMinHours: 0,
    clientPortalShowPrices: true,
    clientPortalShowDuration: true,
    clientPortalShowProfessional: true,
    clientPortalSupportLabel: "Fale com a barbearia",
    clientPortalSupportUrl: "",
    clientPortalBookingSuccessMessage: "Agendamento confirmado com sucesso.",
    clientPortalNoSlotsMessage:
      "Não encontramos horários para essa combinação. Tente outro profissional ou data.",
    clientPortalBookingMinHoursAdvance: 0,
    clientPortalBookingMaxDaysAhead: 30,
    clientPortalMaxActiveAppointments: 1,
    clientPortalNotesEnabled: true,
    clientPortalNotesRequired: false,
    clientPortalBookingInstruction: "Confira os dados antes de confirmar seu agendamento.",
    clientPortalDashboardShowLastVisit: true,
    clientPortalDashboardShowTotalAppointments: true,
    clientPortalDashboardShowMonthCount: true,
    clientPortalDashboardShowNextAppointment: true,
    clientPortalDashboardShowRecentHistory: true,
    clientPortalDashboardHistoryLimit: 5,
    clientPortalAppointmentsShowHistory: true,
    clientPortalAppointmentsHistoryLimit: 20,
    clientPortalEmptyDashboardMessage: "Você ainda não possui histórico de agendamentos.",
    clientPortalEmptyAppointmentsMessage: "Você ainda não possui agendamentos.",
    receiptTemplate: "clean_compact",
  });

  assert.equal(
    calls.upsertMany[0].find((entry) => entry.key === "receipt_template")?.value,
    "clean_compact",
  );
  assert.equal(result.receiptTemplate, "clean_compact");
});

test("validateSettings aceita alias legado e normaliza para modelo 2 canônico", () => {
  const result = validateSettings({
    barbershopName: "AlphaMen",
    phone: "",
    whatsapp: "",
    instagram: "",
    email: "",
    address: {},
    appointmentReminderEnabled: true,
    appointmentReminderEmailEnabled: false,
    appointmentReminderMinutes: 15,
    defaultOpenTime: "09:00",
    defaultCloseTime: "18:00",
    appointmentIntervalMinutes: 5,
    allowClientCancel: true,
    allowClientReschedule: true,
    clientPortalEnabled: true,
    clientPortalBookingEnabled: true,
    clientPortalCancelEnabled: true,
    clientPortalCancelMinHours: 0,
    clientPortalShowPrices: true,
    clientPortalShowDuration: true,
    clientPortalShowProfessional: true,
    clientPortalSupportLabel: "Fale com a barbearia",
    clientPortalSupportUrl: "",
    clientPortalBookingSuccessMessage: "Agendamento confirmado com sucesso.",
    clientPortalNoSlotsMessage:
      "Não encontramos horários para essa combinação. Tente outro profissional ou data.",
    clientPortalBookingMinHoursAdvance: 0,
    clientPortalBookingMaxDaysAhead: 30,
    clientPortalMaxActiveAppointments: 1,
        clientPortalNotesEnabled: true,
        clientPortalNotesRequired: false,
        clientPortalBookingInstruction: "Confira os dados antes de confirmar seu agendamento.",
        clientPortalDashboardShowLastVisit: true,
        clientPortalDashboardShowTotalAppointments: true,
        clientPortalDashboardShowMonthCount: true,
        clientPortalDashboardShowNextAppointment: true,
        clientPortalDashboardShowRecentHistory: true,
        clientPortalDashboardHistoryLimit: 5,
        clientPortalAppointmentsShowHistory: true,
        clientPortalAppointmentsHistoryLimit: 20,
        clientPortalEmptyDashboardMessage: "Você ainda não possui histórico de agendamentos.",
        clientPortalEmptyAppointmentsMessage: "Você ainda não possui agendamentos.",
        receiptTemplate: "model_2",
  });

  assert.equal(result.receiptTemplate, "clean_compact");
});

test("validateSettings rejeita receiptTemplate inválido", () => {
  assert.throws(
    () =>
      validateSettings({
        barbershopName: "AlphaMen",
        phone: "",
        whatsapp: "",
        instagram: "",
        email: "",
        address: {},
        appointmentReminderEnabled: true,
        appointmentReminderEmailEnabled: false,
        appointmentReminderMinutes: 15,
        defaultOpenTime: "09:00",
        defaultCloseTime: "18:00",
        appointmentIntervalMinutes: 5,
        allowClientCancel: true,
        allowClientReschedule: true,
        clientPortalEnabled: true,
        clientPortalBookingEnabled: true,
        clientPortalCancelEnabled: true,
        clientPortalCancelMinHours: 0,
        clientPortalShowPrices: true,
        clientPortalShowDuration: true,
        clientPortalShowProfessional: true,
        clientPortalSupportLabel: "Fale com a barbearia",
        clientPortalSupportUrl: "",
        clientPortalBookingSuccessMessage: "Agendamento confirmado com sucesso.",
        clientPortalNoSlotsMessage:
          "Não encontramos horários para essa combinação. Tente outro profissional ou data.",
        clientPortalBookingMinHoursAdvance: 0,
        clientPortalBookingMaxDaysAhead: 30,
        clientPortalMaxActiveAppointments: 1,
        clientPortalNotesEnabled: true,
        clientPortalNotesRequired: false,
        clientPortalBookingInstruction: "Confira os dados antes de confirmar seu agendamento.",
        clientPortalDashboardShowLastVisit: true,
        clientPortalDashboardShowTotalAppointments: true,
        clientPortalDashboardShowMonthCount: true,
        clientPortalDashboardShowNextAppointment: true,
        clientPortalDashboardShowRecentHistory: true,
        clientPortalDashboardHistoryLimit: 5,
        clientPortalAppointmentsShowHistory: true,
        clientPortalAppointmentsHistoryLimit: 20,
        clientPortalEmptyDashboardMessage: "Você ainda não possui histórico de agendamentos.",
        clientPortalEmptyAppointmentsMessage: "Você ainda não possui agendamentos.",
        receiptTemplate: "modelo_x",
      }),
    (error) => error instanceof ValidationError,
  );
});

test("validateSettings rejeita exigir observação quando observação está desabilitada", () => {
  assert.throws(
    () =>
      validateSettings({
        barbershopName: "AlphaMen",
        phone: "",
        whatsapp: "",
        instagram: "",
        email: "",
        address: {},
        appointmentReminderEnabled: true,
        appointmentReminderEmailEnabled: false,
        appointmentReminderMinutes: 15,
        defaultOpenTime: "09:00",
        defaultCloseTime: "18:00",
        appointmentIntervalMinutes: 5,
        allowClientCancel: true,
        allowClientReschedule: true,
        clientPortalEnabled: true,
        clientPortalBookingEnabled: true,
        clientPortalCancelEnabled: true,
        clientPortalCancelMinHours: 0,
        clientPortalShowPrices: true,
        clientPortalShowDuration: true,
        clientPortalShowProfessional: true,
        clientPortalSupportLabel: "Fale com a barbearia",
        clientPortalSupportUrl: "",
        clientPortalBookingSuccessMessage: "Agendamento confirmado com sucesso.",
        clientPortalNoSlotsMessage:
          "Não encontramos horários para essa combinação. Tente outro profissional ou data.",
        clientPortalBookingMinHoursAdvance: 0,
        clientPortalBookingMaxDaysAhead: 30,
        clientPortalMaxActiveAppointments: 1,
        clientPortalNotesEnabled: false,
        clientPortalNotesRequired: true,
        clientPortalBookingInstruction: "Confira os dados antes de confirmar seu agendamento.",
        clientPortalDashboardShowLastVisit: true,
        clientPortalDashboardShowTotalAppointments: true,
        clientPortalDashboardShowMonthCount: true,
        clientPortalDashboardShowNextAppointment: true,
        clientPortalDashboardShowRecentHistory: true,
        clientPortalDashboardHistoryLimit: 5,
        clientPortalAppointmentsShowHistory: true,
        clientPortalAppointmentsHistoryLimit: 20,
        clientPortalEmptyDashboardMessage: "Você ainda não possui histórico de agendamentos.",
        clientPortalEmptyAppointmentsMessage: "Você ainda não possui agendamentos.",
        receiptTemplate: "classic",
      }),
    (error) => error instanceof ValidationError,
  );
});

test("getPublicLoginAppearance retorna apenas campos seguros", async () => {
  const updatedAt = "2026-06-23T12:30:00.000Z";
  const { service } = createServiceHarness({
    getManyResult: [
      buildSettingRow("login_appearance_hero_title", "Título seguro", updatedAt),
      buildSettingRow("login_appearance_hero_subtitle", "Descrição", updatedAt),
      buildSettingRow("login_appearance_hero_eyebrow", "Destaque", updatedAt),
      buildSettingRow("login_appearance_button_text", "ACESSAR", updatedAt),
      buildSettingRow(
        "login_appearance_background_image_url",
        "/login-appearance-assets/login.webp",
        updatedAt,
      ),
      buildSettingRow("login_appearance_background_image_alt", "Fachada da barbearia", updatedAt),
    ],
  });

  const result = await service.getPublicLoginAppearance();

  assert.deepEqual(result, {
    heroTitle: "Título seguro",
    heroSubtitle: "Descrição",
    heroEyebrow: "Destaque",
    loginButtonText: "ACESSAR",
    backgroundImageUrl: "/login-appearance-assets/login.webp",
    backgroundImageAlt: "Fachada da barbearia",
    updatedAt,
  });
  assert.equal("id" in result, false);
});

test("saveLoginAppearanceBackground rejeita MIME inválido", async () => {
  const { service } = createServiceHarness();

  await assert.rejects(
    () =>
      service.saveLoginAppearanceBackground({
        body: Buffer.from("fake"),
        mimeType: "image/svg+xml",
        originalName: "hero.svg",
      }),
  );
});

test("saveLoginAppearanceBackground rejeita arquivo acima de 2 MB", async () => {
  const { service } = createServiceHarness();

  await assert.rejects(
    () =>
      service.saveLoginAppearanceBackground({
        body: Buffer.alloc(2 * 1024 * 1024 + 1, 1),
        mimeType: "image/png",
        originalName: "hero.png",
      }),
  );
});

test("saveLoginAppearanceBackground aceita WEBP válido e remove imagem anterior", async () => {
  const { service, calls } = createServiceHarness({
    getManyResult: [
      buildSettingRow("login_appearance_background_image_url", "/login-appearance-assets/old.webp"),
    ],
  });

  const result = await service.saveLoginAppearanceBackground({
    body: Buffer.from([1, 2, 3]),
    mimeType: "image/webp",
    originalName: "../../Hero Final.webp",
  });

  assert.match(result.backgroundImageUrl, /^\/login-appearance-assets\/\d+-hero-final\.webp$/);
  assert.equal(calls.ensureStorageDir, 1);
  assert.equal(calls.writeFile.length, 1);
  assert.equal(calls.upsertMany.length, 1);
  assert.deepEqual(calls.removeStoredBackgroundImage, ["/login-appearance-assets/old.webp"]);
});

test("restoreDefaultLoginAppearance limpa imagem e volta ao fallback", async () => {
  let stage = "current";
  const { service, calls } = createServiceHarness({
    async getMany() {
      if (stage === "current") {
        return [
          buildSettingRow("login_appearance_hero_title", "Custom"),
          buildSettingRow("login_appearance_background_image_url", "/login-appearance-assets/custom.jpg"),
        ];
      }

      return [];
    },
    async upsertMany(pairs) {
      calls.upsertMany.push(pairs);
      stage = "restored";
      return pairs;
    },
  });

  const result = await service.restoreDefaultLoginAppearance();

  assert.equal(calls.upsertMany.length, 1);
  assert.deepEqual(calls.removeStoredBackgroundImage, ["/login-appearance-assets/custom.jpg"]);
  assert.deepEqual(result, LOGIN_APPEARANCE_DEFAULTS);
});

test("validateLoginAppearance converte string vazia opcional em null", () => {
  const result = validateLoginAppearance({
    heroTitle: "Tela AlphaMen",
    heroSubtitle: " ",
    heroEyebrow: "",
    loginButtonText: "",
    backgroundImageUrl: "",
    backgroundImageAlt: " ",
  });

  assert.deepEqual(result, {
    heroTitle: "Tela AlphaMen",
    heroSubtitle: null,
    heroEyebrow: null,
    loginButtonText: null,
    backgroundImageUrl: null,
    backgroundImageAlt: null,
  });
});

test("validateLoginAppearance rejeita HTML perigoso", () => {
  assert.throws(
    () =>
      validateLoginAppearance({
        heroTitle: "<script>alert(1)</script>",
      }),
    (error) => error instanceof ValidationError,
  );
});

test("getPublicPortalSettings aplica defaults e converte opcionais vazios para null", async () => {
  const { service } = createServiceHarness({
    getManyResult: [
      buildSettingRow("public_portal_enabled", "true"),
      buildSettingRow("public_portal_hero_title", "AlphaMen Premium"),
      buildSettingRow("public_portal_hero_subtitle", ""),
      buildSettingRow("public_portal_cta_label", ""),
      buildSettingRow("public_portal_whatsapp", ""),
      buildSettingRow("public_portal_show_service_prices", "false"),
    ],
  });

  const result = await service.getPublicPortalSettings();

  assert.deepEqual(result, {
    enabled: true,
    heroTitle: "AlphaMen Premium",
    heroSubtitle: "Estilo é identidade.",
    heroDescription: null,
    aboutTitle: null,
    aboutText: null,
    ctaLabel: "Agendar",
    ctaUrl: null,
    whatsapp: null,
    instagram: null,
    address: null,
    openingHoursText: null,
    showServicePrices: false,
    showProductPrices: true,
    heroImageUrl: null,
    logoUrl: null,
  });
});

test("updatePublicPortalSettings persiste apenas campos públicos explícitos", async () => {
  const { service, calls } = createServiceHarness({
    getManyResult: [
      buildSettingRow("public_portal_enabled", "false"),
    ],
  });

  await service.updatePublicPortalSettings({
    enabled: true,
    heroTitle: "Portal Alpha",
    heroSubtitle: null,
    heroDescription: null,
    aboutTitle: "Nossa história",
    aboutText: "Texto institucional",
    ctaLabel: "Agendar agora",
    ctaUrl: "https://wa.me/5511999999999",
    whatsapp: "5511999999999",
    instagram: "https://instagram.com/alphamen",
    address: "Rua Exemplo, 100",
    openingHoursText: "Seg a sáb, 09h às 18h",
    showServicePrices: true,
    showProductPrices: false,
    heroImageUrl: null,
    logoUrl: null,
  });

  assert.equal(calls.upsertMany.length, 1);
  assert.deepEqual(calls.upsertMany[0], [
    { key: "public_portal_enabled", value: "true" },
    { key: "public_portal_hero_title", value: "Portal Alpha" },
    { key: "public_portal_hero_subtitle", value: "" },
    { key: "public_portal_hero_description", value: "" },
    { key: "public_portal_about_title", value: "Nossa história" },
    { key: "public_portal_about_text", value: "Texto institucional" },
    { key: "public_portal_cta_label", value: "Agendar agora" },
    { key: "public_portal_cta_url", value: "https://wa.me/5511999999999" },
    { key: "public_portal_whatsapp", value: "5511999999999" },
    { key: "public_portal_instagram", value: "https://instagram.com/alphamen" },
    { key: "public_portal_address", value: "Rua Exemplo, 100" },
    { key: "public_portal_opening_hours_text", value: "Seg a sáb, 09h às 18h" },
    { key: "public_portal_show_service_prices", value: "true" },
    { key: "public_portal_show_product_prices", value: "false" },
    { key: "public_portal_hero_image_url", value: "" },
    { key: "public_portal_logo_url", value: "" },
  ]);
});

test("validatePublicPortalSettings converte opcionais vazios para null e mantém booleans", () => {
  const result = validatePublicPortalSettings({
    enabled: true,
    heroTitle: "Portal Alpha",
    heroSubtitle: " ",
    heroDescription: "",
    aboutTitle: "",
    aboutText: " ",
    ctaLabel: "Agendar",
    ctaUrl: "",
    whatsapp: "",
    instagram: "",
    address: "",
    openingHoursText: "",
    showServicePrices: true,
    showProductPrices: false,
    heroImageUrl: "",
    logoUrl: "",
  });

  assert.deepEqual(result, {
    enabled: true,
    heroTitle: "Portal Alpha",
    heroSubtitle: null,
    heroDescription: null,
    aboutTitle: null,
    aboutText: null,
    ctaLabel: "Agendar",
    ctaUrl: null,
    whatsapp: null,
    instagram: null,
    address: null,
    openingHoursText: null,
    showServicePrices: true,
    showProductPrices: false,
    heroImageUrl: null,
    logoUrl: null,
  });
});

test("validatePublicPortalSettings rejeita HTML e URLs inválidas", () => {
  assert.throws(
    () =>
      validatePublicPortalSettings({
        enabled: true,
        heroTitle: "<script>alert(1)</script>",
        ctaLabel: "Agendar",
        showServicePrices: true,
        showProductPrices: true,
      }),
    (error) => error instanceof ValidationError,
  );

  assert.throws(
    () =>
      validatePublicPortalSettings({
        enabled: true,
        heroTitle: "Portal Alpha",
        ctaLabel: "Agendar",
        ctaUrl: "ftp://invalid",
        showServicePrices: true,
        showProductPrices: true,
      }),
    (error) => error instanceof ValidationError,
  );
});
