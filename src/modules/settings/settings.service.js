import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { BadRequestError } from "../../errors/BadRequestError.js";
import { getMany, upsertMany } from "./settings.repository.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const storageRoot = path.resolve(__dirname, "../../../storage/login-appearance");

const GENERAL_KEYS = [
  "barbershop_name",
  "barbershop_phone",
  "barbershop_whatsapp",
  "barbershop_instagram",
  "barbershop_email",
  "barbershop_street",
  "barbershop_number",
  "barbershop_district",
  "barbershop_city",
  "barbershop_state",
  "barbershop_zipcode",
  "appointment_reminder_enabled",
  "appointment_reminder_email_enabled",
  "appointment_reminder_minutes",
  "default_open_time",
  "default_close_time",
  "appointment_interval_minutes",
  "allow_client_cancel",
  "allow_client_reschedule",
  "receipt_template",
  "client_portal_enabled",
  "client_portal_self_signup_enabled",
  "client_portal_require_admin_approval",
  "client_portal_google_login_enabled",
  "client_portal_booking_enabled",
  "client_portal_cancel_enabled",
  "client_portal_cancel_min_hours",
  "client_portal_show_prices",
  "client_portal_show_duration",
  "client_portal_show_professional",
  "client_portal_support_label",
  "client_portal_support_url",
  "client_portal_booking_success_message",
  "client_portal_no_slots_message",
  "client_portal_booking_min_hours_advance",
  "client_portal_booking_max_days_ahead",
  "client_portal_max_active_appointments",
  "client_portal_notes_enabled",
  "client_portal_notes_required",
  "client_portal_booking_instruction",
  "client_portal_dashboard_show_last_visit",
  "client_portal_dashboard_show_total_appointments",
  "client_portal_dashboard_show_month_count",
  "client_portal_dashboard_show_next_appointment",
  "client_portal_dashboard_show_recent_history",
  "client_portal_dashboard_history_limit",
  "client_portal_appointments_show_history",
  "client_portal_appointments_history_limit",
  "client_portal_empty_dashboard_message",
  "client_portal_empty_appointments_message",
];

const GENERAL_DEFAULTS = {
  barbershop_name: "",
  barbershop_phone: "",
  barbershop_whatsapp: "",
  barbershop_instagram: "",
  barbershop_email: "",
  barbershop_street: "",
  barbershop_number: "",
  barbershop_district: "",
  barbershop_city: "",
  barbershop_state: "",
  barbershop_zipcode: "",
  appointment_reminder_enabled: "true",
  appointment_reminder_email_enabled: "false",
  appointment_reminder_minutes: "15",
  default_open_time: "09:00",
  default_close_time: "18:00",
  appointment_interval_minutes: "5",
  allow_client_cancel: "true",
  allow_client_reschedule: "true",
  receipt_template: "classic",
  client_portal_enabled: "true",
  client_portal_self_signup_enabled: "true",
  client_portal_require_admin_approval: "false",
  client_portal_google_login_enabled: "false",
  client_portal_booking_enabled: "true",
  client_portal_cancel_enabled: "true",
  client_portal_cancel_min_hours: "0",
  client_portal_show_prices: "true",
  client_portal_show_duration: "true",
  client_portal_show_professional: "true",
  client_portal_support_label: "Fale com a barbearia",
  client_portal_support_url: "",
  client_portal_booking_success_message: "Agendamento confirmado com sucesso.",
  client_portal_no_slots_message:
    "Não encontramos horários para essa combinação. Tente outro profissional ou data.",
  client_portal_booking_min_hours_advance: "0",
  client_portal_booking_max_days_ahead: "30",
  client_portal_max_active_appointments: "1",
  client_portal_notes_enabled: "true",
  client_portal_notes_required: "false",
  client_portal_booking_instruction: "Confira os dados antes de confirmar seu agendamento.",
  client_portal_dashboard_show_last_visit: "true",
  client_portal_dashboard_show_total_appointments: "true",
  client_portal_dashboard_show_month_count: "true",
  client_portal_dashboard_show_next_appointment: "true",
  client_portal_dashboard_show_recent_history: "true",
  client_portal_dashboard_history_limit: "5",
  client_portal_appointments_show_history: "true",
  client_portal_appointments_history_limit: "20",
  client_portal_empty_dashboard_message: "Você ainda não possui histórico de agendamentos.",
  client_portal_empty_appointments_message: "Você ainda não possui agendamentos.",
};

const LOGIN_APPEARANCE_KEYS = [
  "login_appearance_hero_title",
  "login_appearance_hero_subtitle",
  "login_appearance_hero_eyebrow",
  "login_appearance_button_text",
  "login_appearance_background_image_url",
  "login_appearance_background_image_alt",
];

const CLIENT_PORTAL_DEFAULTS = {
  enabled: true,
  selfSignupEnabled: true,
  requireAdminApproval: false,
  googleLoginEnabled: false,
  bookingEnabled: true,
  cancelEnabled: true,
  cancelMinHours: 0,
  showPrices: true,
  showDuration: true,
  showProfessional: true,
  supportLabel: "Fale com a barbearia",
  supportUrl: "",
  bookingSuccessMessage: "Agendamento confirmado com sucesso.",
  noSlotsMessage:
    "Não encontramos horários para essa combinação. Tente outro profissional ou data.",
  bookingMinHoursAdvance: 0,
  bookingMaxDaysAhead: 30,
  maxActiveAppointments: 1,
  notesEnabled: true,
  notesRequired: false,
  bookingInstruction: "Confira os dados antes de confirmar seu agendamento.",
  dashboardShowLastVisit: true,
  dashboardShowTotalAppointments: true,
  dashboardShowMonthCount: true,
  dashboardShowNextAppointment: true,
  dashboardShowRecentHistory: true,
  dashboardHistoryLimit: 5,
  appointmentsShowHistory: true,
  appointmentsHistoryLimit: 20,
  emptyDashboardMessage: "Você ainda não possui histórico de agendamentos.",
  emptyAppointmentsMessage: "Você ainda não possui agendamentos.",
};

export const LOGIN_APPEARANCE_DEFAULTS = {
  heroTitle: "ESTILO NÃO É MODA, É IDENTIDADE.",
  heroSubtitle:
    "Gestão completa da sua barbearia em um só lugar. Mais tempo para o que realmente importa: seus clientes.",
  heroEyebrow: "ALPHAMEN BARBEARIA",
  loginButtonText: "ENTRAR",
  backgroundImageUrl: null,
  backgroundImageAlt: "Ambiente da barbearia AlphaMen",
  updatedAt: null,
};

const allowedUploadMimeTypes = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

const MAX_BACKGROUND_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;
const publicAssetPrefix = "/login-appearance-assets";
const RECEIPT_TEMPLATE_DEFAULT = "classic";
const RECEIPT_TEMPLATE_ALIASES = new Map([
  ["classic", "classic"],
  ["model_1", "classic"],
  ["modelo_1", "classic"],
  ["1", "classic"],
  ["clean_compact", "clean_compact"],
  ["clean-compact", "clean_compact"],
  ["model_2", "clean_compact"],
  ["modelo_2", "clean_compact"],
  ["2", "clean_compact"],
]);

function toSettingsMap(rows) {
  const map = {};

  for (const row of rows) {
    map[row.key] = row.value;
    map[`${row.key}__updatedAt`] = row.updatedAt;
  }

  return map;
}

function shapeSettings(map) {
  const get = (key) => map[key] ?? GENERAL_DEFAULTS[key];

  return {
    barbershopName: get("barbershop_name"),
    phone: get("barbershop_phone"),
    whatsapp: get("barbershop_whatsapp"),
    instagram: get("barbershop_instagram"),
    email: get("barbershop_email"),
    address: {
      street: get("barbershop_street"),
      number: get("barbershop_number"),
      district: get("barbershop_district"),
      city: get("barbershop_city"),
      state: get("barbershop_state"),
      zipcode: get("barbershop_zipcode"),
    },
    appointmentReminderEnabled: get("appointment_reminder_enabled") === "true",
    appointmentReminderEmailEnabled:
      get("appointment_reminder_email_enabled") === "true",
    appointmentReminderMinutes: parseInt(get("appointment_reminder_minutes"), 10),
    defaultOpenTime: get("default_open_time"),
    defaultCloseTime: get("default_close_time"),
    appointmentIntervalMinutes: parseInt(get("appointment_interval_minutes"), 10),
    allowClientCancel: get("allow_client_cancel") === "true",
    allowClientReschedule: get("allow_client_reschedule") === "true",
    receiptTemplate: normalizeReceiptTemplate(get("receipt_template")),
    clientPortalEnabled: get("client_portal_enabled") === "true",
    clientPortalSelfSignupEnabled:
      get("client_portal_self_signup_enabled") === "true",
    clientPortalRequireAdminApproval:
      get("client_portal_require_admin_approval") === "true",
    clientPortalGoogleLoginEnabled:
      get("client_portal_google_login_enabled") === "true",
    clientPortalBookingEnabled: get("client_portal_booking_enabled") === "true",
    clientPortalCancelEnabled: get("client_portal_cancel_enabled") === "true",
    clientPortalCancelMinHours: parseInt(get("client_portal_cancel_min_hours"), 10),
    clientPortalShowPrices: get("client_portal_show_prices") === "true",
    clientPortalShowDuration: get("client_portal_show_duration") === "true",
    clientPortalShowProfessional: get("client_portal_show_professional") === "true",
    clientPortalSupportLabel: get("client_portal_support_label"),
    clientPortalSupportUrl: getClientPortalSupportUrl(map),
    clientPortalBookingSuccessMessage: get("client_portal_booking_success_message"),
    clientPortalNoSlotsMessage: get("client_portal_no_slots_message"),
    clientPortalBookingMinHoursAdvance: parseInt(
      get("client_portal_booking_min_hours_advance"),
      10,
    ),
    clientPortalBookingMaxDaysAhead: parseInt(
      get("client_portal_booking_max_days_ahead"),
      10,
    ),
    clientPortalMaxActiveAppointments: parseInt(
      get("client_portal_max_active_appointments"),
      10,
    ),
    clientPortalNotesEnabled: get("client_portal_notes_enabled") === "true",
    clientPortalNotesRequired:
      get("client_portal_notes_enabled") === "true" &&
      get("client_portal_notes_required") === "true",
    clientPortalBookingInstruction: get("client_portal_booking_instruction"),
    clientPortalDashboardShowLastVisit:
      get("client_portal_dashboard_show_last_visit") === "true",
    clientPortalDashboardShowTotalAppointments:
      get("client_portal_dashboard_show_total_appointments") === "true",
    clientPortalDashboardShowMonthCount:
      get("client_portal_dashboard_show_month_count") === "true",
    clientPortalDashboardShowNextAppointment:
      get("client_portal_dashboard_show_next_appointment") === "true",
    clientPortalDashboardShowRecentHistory:
      get("client_portal_dashboard_show_recent_history") === "true",
    clientPortalDashboardHistoryLimit: parseInt(
      get("client_portal_dashboard_history_limit"),
      10,
    ),
    clientPortalAppointmentsShowHistory:
      get("client_portal_appointments_show_history") === "true",
    clientPortalAppointmentsHistoryLimit: parseInt(
      get("client_portal_appointments_history_limit"),
      10,
    ),
    clientPortalEmptyDashboardMessage: get("client_portal_empty_dashboard_message"),
    clientPortalEmptyAppointmentsMessage: get("client_portal_empty_appointments_message"),
  };
}

function toGeneralKeyValuePairs(payload) {
  return [
    { key: "barbershop_name", value: payload.barbershopName },
    { key: "barbershop_phone", value: payload.phone },
    { key: "barbershop_whatsapp", value: payload.whatsapp },
    { key: "barbershop_instagram", value: payload.instagram },
    { key: "barbershop_email", value: payload.email },
    { key: "barbershop_street", value: payload.address?.street ?? "" },
    { key: "barbershop_number", value: payload.address?.number ?? "" },
    { key: "barbershop_district", value: payload.address?.district ?? "" },
    { key: "barbershop_city", value: payload.address?.city ?? "" },
    { key: "barbershop_state", value: payload.address?.state ?? "" },
    { key: "barbershop_zipcode", value: payload.address?.zipcode ?? "" },
    { key: "appointment_reminder_enabled", value: String(payload.appointmentReminderEnabled) },
    {
      key: "appointment_reminder_email_enabled",
      value: String(payload.appointmentReminderEmailEnabled),
    },
    { key: "appointment_reminder_minutes", value: String(payload.appointmentReminderMinutes) },
    { key: "default_open_time", value: payload.defaultOpenTime },
    { key: "default_close_time", value: payload.defaultCloseTime },
    { key: "appointment_interval_minutes", value: String(payload.appointmentIntervalMinutes) },
    { key: "allow_client_cancel", value: String(payload.allowClientCancel) },
    { key: "allow_client_reschedule", value: String(payload.allowClientReschedule) },
    {
      key: "receipt_template",
      value: normalizeReceiptTemplate(payload.receiptTemplate),
    },
    { key: "client_portal_enabled", value: String(payload.clientPortalEnabled) },
    {
      key: "client_portal_self_signup_enabled",
      value: String(payload.clientPortalSelfSignupEnabled),
    },
    {
      key: "client_portal_require_admin_approval",
      value: String(payload.clientPortalRequireAdminApproval),
    },
    {
      key: "client_portal_google_login_enabled",
      value: String(payload.clientPortalGoogleLoginEnabled),
    },
    {
      key: "client_portal_booking_enabled",
      value: String(payload.clientPortalBookingEnabled),
    },
    {
      key: "client_portal_cancel_enabled",
      value: String(payload.clientPortalCancelEnabled),
    },
    {
      key: "client_portal_cancel_min_hours",
      value: String(payload.clientPortalCancelMinHours),
    },
    {
      key: "client_portal_show_prices",
      value: String(payload.clientPortalShowPrices),
    },
    {
      key: "client_portal_show_duration",
      value: String(payload.clientPortalShowDuration),
    },
    {
      key: "client_portal_show_professional",
      value: String(payload.clientPortalShowProfessional),
    },
    {
      key: "client_portal_support_label",
      value: payload.clientPortalSupportLabel,
    },
    {
      key: "client_portal_support_url",
      value: payload.clientPortalSupportUrl,
    },
    {
      key: "client_portal_booking_success_message",
      value: payload.clientPortalBookingSuccessMessage,
    },
    {
      key: "client_portal_no_slots_message",
      value: payload.clientPortalNoSlotsMessage,
    },
    {
      key: "client_portal_booking_min_hours_advance",
      value: String(payload.clientPortalBookingMinHoursAdvance),
    },
    {
      key: "client_portal_booking_max_days_ahead",
      value: String(payload.clientPortalBookingMaxDaysAhead),
    },
    {
      key: "client_portal_max_active_appointments",
      value: String(payload.clientPortalMaxActiveAppointments),
    },
    {
      key: "client_portal_notes_enabled",
      value: String(payload.clientPortalNotesEnabled),
    },
    {
      key: "client_portal_notes_required",
      value: String(payload.clientPortalNotesRequired),
    },
    {
      key: "client_portal_booking_instruction",
      value: payload.clientPortalBookingInstruction,
    },
    {
      key: "client_portal_dashboard_show_last_visit",
      value: String(payload.clientPortalDashboardShowLastVisit),
    },
    {
      key: "client_portal_dashboard_show_total_appointments",
      value: String(payload.clientPortalDashboardShowTotalAppointments),
    },
    {
      key: "client_portal_dashboard_show_month_count",
      value: String(payload.clientPortalDashboardShowMonthCount),
    },
    {
      key: "client_portal_dashboard_show_next_appointment",
      value: String(payload.clientPortalDashboardShowNextAppointment),
    },
    {
      key: "client_portal_dashboard_show_recent_history",
      value: String(payload.clientPortalDashboardShowRecentHistory),
    },
    {
      key: "client_portal_dashboard_history_limit",
      value: String(payload.clientPortalDashboardHistoryLimit),
    },
    {
      key: "client_portal_appointments_show_history",
      value: String(payload.clientPortalAppointmentsShowHistory),
    },
    {
      key: "client_portal_appointments_history_limit",
      value: String(payload.clientPortalAppointmentsHistoryLimit),
    },
    {
      key: "client_portal_empty_dashboard_message",
      value: payload.clientPortalEmptyDashboardMessage,
    },
    {
      key: "client_portal_empty_appointments_message",
      value: payload.clientPortalEmptyAppointmentsMessage,
    },
  ];
}

export function normalizeReceiptTemplate(value) {
  if (typeof value !== "string") {
    return RECEIPT_TEMPLATE_DEFAULT;
  }

  const normalized = RECEIPT_TEMPLATE_ALIASES.get(value.trim().toLowerCase());
  return normalized ?? RECEIPT_TEMPLATE_DEFAULT;
}

function applyLoginAppearanceFallback(config) {
  return {
    heroTitle: config.heroTitle || LOGIN_APPEARANCE_DEFAULTS.heroTitle,
    heroSubtitle:
      config.heroSubtitle === null ? LOGIN_APPEARANCE_DEFAULTS.heroSubtitle : config.heroSubtitle,
    heroEyebrow:
      config.heroEyebrow === null ? LOGIN_APPEARANCE_DEFAULTS.heroEyebrow : config.heroEyebrow,
    loginButtonText:
      config.loginButtonText === null
        ? LOGIN_APPEARANCE_DEFAULTS.loginButtonText
        : config.loginButtonText,
    backgroundImageUrl: config.backgroundImageUrl || LOGIN_APPEARANCE_DEFAULTS.backgroundImageUrl,
    backgroundImageAlt:
      config.backgroundImageAlt === null
        ? LOGIN_APPEARANCE_DEFAULTS.backgroundImageAlt
        : config.backgroundImageAlt,
    updatedAt: config.updatedAt ?? LOGIN_APPEARANCE_DEFAULTS.updatedAt,
  };
}

function shapeLoginAppearance(map) {
  const heroTitle = map.login_appearance_hero_title?.trim() || LOGIN_APPEARANCE_DEFAULTS.heroTitle;
  const heroSubtitle = map.login_appearance_hero_subtitle?.trim() || null;
  const heroEyebrow = map.login_appearance_hero_eyebrow?.trim() || null;
  const loginButtonText = map.login_appearance_button_text?.trim() || null;
  const backgroundImageUrl = map.login_appearance_background_image_url?.trim() || null;
  const backgroundImageAlt = map.login_appearance_background_image_alt?.trim() || null;

  const updatedAtCandidates = [
    map.login_appearance_hero_title__updatedAt,
    map.login_appearance_hero_subtitle__updatedAt,
    map.login_appearance_hero_eyebrow__updatedAt,
    map.login_appearance_button_text__updatedAt,
    map.login_appearance_background_image_url__updatedAt,
    map.login_appearance_background_image_alt__updatedAt,
  ].filter(Boolean);

  const updatedAt =
    updatedAtCandidates.length > 0
      ? new Date(
          Math.max(
            ...updatedAtCandidates.map((value) =>
              value instanceof Date ? value.getTime() : new Date(value).getTime(),
            ),
          ),
        ).toISOString()
      : null;

  return applyLoginAppearanceFallback({
    heroTitle,
    heroSubtitle,
    heroEyebrow,
    loginButtonText,
    backgroundImageUrl,
    backgroundImageAlt,
    updatedAt,
  });
}

function getPublicPortalString(map, key, fallback = null) {
  const value = map[key];

  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeBooleanSetting(value, fallback) {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function normalizeIntegerSetting(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function buildWhatsAppSupportUrl(whatsapp) {
  if (typeof whatsapp !== "string") {
    return "";
  }

  const digits = whatsapp.replace(/\D/g, "");
  if (!digits) {
    return "";
  }

  return `https://wa.me/${digits}`;
}

function getClientPortalSupportUrl(map) {
  const explicit = map.client_portal_support_url?.trim();

  if (explicit) {
    return explicit;
  }

  return buildWhatsAppSupportUrl(map.barbershop_whatsapp ?? GENERAL_DEFAULTS.barbershop_whatsapp);
}

function shapeClientPortalSettings(map) {
  return {
    enabled: normalizeBooleanSetting(
      map.client_portal_enabled,
      CLIENT_PORTAL_DEFAULTS.enabled,
    ),
    selfSignupEnabled: normalizeBooleanSetting(
      map.client_portal_self_signup_enabled,
      CLIENT_PORTAL_DEFAULTS.selfSignupEnabled,
    ),
    requireAdminApproval: normalizeBooleanSetting(
      map.client_portal_require_admin_approval,
      CLIENT_PORTAL_DEFAULTS.requireAdminApproval,
    ),
    googleLoginEnabled: normalizeBooleanSetting(
      map.client_portal_google_login_enabled,
      CLIENT_PORTAL_DEFAULTS.googleLoginEnabled,
    ),
    bookingEnabled: normalizeBooleanSetting(
      map.client_portal_booking_enabled,
      CLIENT_PORTAL_DEFAULTS.bookingEnabled,
    ),
    cancelEnabled: normalizeBooleanSetting(
      map.client_portal_cancel_enabled,
      CLIENT_PORTAL_DEFAULTS.cancelEnabled,
    ),
    cancelMinHours: normalizeIntegerSetting(
      map.client_portal_cancel_min_hours,
      CLIENT_PORTAL_DEFAULTS.cancelMinHours,
    ),
    showPrices: normalizeBooleanSetting(
      map.client_portal_show_prices,
      CLIENT_PORTAL_DEFAULTS.showPrices,
    ),
    showDuration: normalizeBooleanSetting(
      map.client_portal_show_duration,
      CLIENT_PORTAL_DEFAULTS.showDuration,
    ),
    showProfessional: normalizeBooleanSetting(
      map.client_portal_show_professional,
      CLIENT_PORTAL_DEFAULTS.showProfessional,
    ),
    supportLabel:
      getPublicPortalString(
        map,
        "client_portal_support_label",
        CLIENT_PORTAL_DEFAULTS.supportLabel,
      ) ?? CLIENT_PORTAL_DEFAULTS.supportLabel,
    supportUrl: getClientPortalSupportUrl(map),
    bookingSuccessMessage:
      getPublicPortalString(
        map,
        "client_portal_booking_success_message",
        CLIENT_PORTAL_DEFAULTS.bookingSuccessMessage,
      ) ?? CLIENT_PORTAL_DEFAULTS.bookingSuccessMessage,
    noSlotsMessage:
      getPublicPortalString(
        map,
        "client_portal_no_slots_message",
        CLIENT_PORTAL_DEFAULTS.noSlotsMessage,
      ) ?? CLIENT_PORTAL_DEFAULTS.noSlotsMessage,
    bookingMinHoursAdvance: normalizeIntegerSetting(
      map.client_portal_booking_min_hours_advance,
      CLIENT_PORTAL_DEFAULTS.bookingMinHoursAdvance,
    ),
    bookingMaxDaysAhead: normalizeIntegerSetting(
      map.client_portal_booking_max_days_ahead,
      CLIENT_PORTAL_DEFAULTS.bookingMaxDaysAhead,
    ),
    maxActiveAppointments: normalizeIntegerSetting(
      map.client_portal_max_active_appointments,
      CLIENT_PORTAL_DEFAULTS.maxActiveAppointments,
    ),
    notesEnabled: normalizeBooleanSetting(
      map.client_portal_notes_enabled,
      CLIENT_PORTAL_DEFAULTS.notesEnabled,
    ),
    notesRequired:
      normalizeBooleanSetting(
        map.client_portal_notes_enabled,
        CLIENT_PORTAL_DEFAULTS.notesEnabled,
      ) &&
      normalizeBooleanSetting(
        map.client_portal_notes_required,
        CLIENT_PORTAL_DEFAULTS.notesRequired,
      ),
    bookingInstruction:
      getPublicPortalString(
        map,
        "client_portal_booking_instruction",
        CLIENT_PORTAL_DEFAULTS.bookingInstruction,
      ) ?? CLIENT_PORTAL_DEFAULTS.bookingInstruction,
    dashboardShowLastVisit: normalizeBooleanSetting(
      map.client_portal_dashboard_show_last_visit,
      CLIENT_PORTAL_DEFAULTS.dashboardShowLastVisit,
    ),
    dashboardShowTotalAppointments: normalizeBooleanSetting(
      map.client_portal_dashboard_show_total_appointments,
      CLIENT_PORTAL_DEFAULTS.dashboardShowTotalAppointments,
    ),
    dashboardShowMonthCount: normalizeBooleanSetting(
      map.client_portal_dashboard_show_month_count,
      CLIENT_PORTAL_DEFAULTS.dashboardShowMonthCount,
    ),
    dashboardShowNextAppointment: normalizeBooleanSetting(
      map.client_portal_dashboard_show_next_appointment,
      CLIENT_PORTAL_DEFAULTS.dashboardShowNextAppointment,
    ),
    dashboardShowRecentHistory: normalizeBooleanSetting(
      map.client_portal_dashboard_show_recent_history,
      CLIENT_PORTAL_DEFAULTS.dashboardShowRecentHistory,
    ),
    dashboardHistoryLimit: normalizeIntegerSetting(
      map.client_portal_dashboard_history_limit,
      CLIENT_PORTAL_DEFAULTS.dashboardHistoryLimit,
    ),
    appointmentsShowHistory: normalizeBooleanSetting(
      map.client_portal_appointments_show_history,
      CLIENT_PORTAL_DEFAULTS.appointmentsShowHistory,
    ),
    appointmentsHistoryLimit: normalizeIntegerSetting(
      map.client_portal_appointments_history_limit,
      CLIENT_PORTAL_DEFAULTS.appointmentsHistoryLimit,
    ),
    emptyDashboardMessage:
      getPublicPortalString(
        map,
        "client_portal_empty_dashboard_message",
        CLIENT_PORTAL_DEFAULTS.emptyDashboardMessage,
      ) ?? CLIENT_PORTAL_DEFAULTS.emptyDashboardMessage,
    emptyAppointmentsMessage:
      getPublicPortalString(
        map,
        "client_portal_empty_appointments_message",
        CLIENT_PORTAL_DEFAULTS.emptyAppointmentsMessage,
      ) ?? CLIENT_PORTAL_DEFAULTS.emptyAppointmentsMessage,
  };
}

function toLoginAppearanceKeyValuePairs(payload) {
  return [
    { key: "login_appearance_hero_title", value: payload.heroTitle },
    { key: "login_appearance_hero_subtitle", value: payload.heroSubtitle ?? "" },
    { key: "login_appearance_hero_eyebrow", value: payload.heroEyebrow ?? "" },
    { key: "login_appearance_button_text", value: payload.loginButtonText ?? "" },
    {
      key: "login_appearance_background_image_url",
      value: payload.backgroundImageUrl ?? "",
    },
    {
      key: "login_appearance_background_image_alt",
      value: payload.backgroundImageAlt ?? "",
    },
  ];
}

function getFilenameFromUrl(urlValue) {
  if (!urlValue || !urlValue.startsWith(`${publicAssetPrefix}/`)) {
    return null;
  }

  const filename = path.basename(urlValue);
  return filename && filename !== "." ? filename : null;
}

async function ensureStorageDir() {
  await fs.mkdir(storageRoot, { recursive: true });
}

async function removeStoredBackgroundImage(urlValue) {
  const filename = getFilenameFromUrl(urlValue);

  if (!filename) {
    return;
  }

  const targetPath = path.join(storageRoot, filename);
  await fs.rm(targetPath, { force: true });
}

function sanitizeFileStem(value) {
  const stem = path.basename(value, path.extname(value)).toLowerCase();
  const sanitized = stem.replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return sanitized || "background";
}

function validateUploadInput({ body, mimeType, originalName }) {
  if (!Buffer.isBuffer(body) || body.length === 0) {
    throw new BadRequestError("Envie uma imagem válida no corpo da requisição.");
  }

  if (body.length > MAX_BACKGROUND_IMAGE_SIZE_BYTES) {
    throw new BadRequestError("A imagem de fundo deve ter no máximo 2 MB.");
  }

  const normalizedMimeType = typeof mimeType === "string" ? mimeType.toLowerCase().trim() : "";
  const allowedExtension = allowedUploadMimeTypes.get(normalizedMimeType);

  if (!allowedExtension) {
    throw new BadRequestError("Formato inválido. Use JPG, PNG ou WEBP.");
  }

  const normalizedOriginalName =
    typeof originalName === "string" ? originalName.trim() : "background";
  const originalExtension = path.extname(normalizedOriginalName).toLowerCase();

  if (originalExtension && originalExtension !== allowedExtension) {
    throw new BadRequestError("A extensão do arquivo não corresponde ao tipo enviado.");
  }

  return {
    extension: allowedExtension,
    safeStem: sanitizeFileStem(normalizedOriginalName),
  };
}

export function createSettingsService(deps = {}) {
  const repository = {
    getMany: deps.getMany ?? getMany,
    upsertMany: deps.upsertMany ?? upsertMany,
    ensureStorageDir: deps.ensureStorageDir ?? ensureStorageDir,
    removeStoredBackgroundImage:
      deps.removeStoredBackgroundImage ?? removeStoredBackgroundImage,
    writeFile: deps.writeFile ?? fs.writeFile,
  };

  async function getSettings() {
    const rows = await repository.getMany(GENERAL_KEYS);
    const map = toSettingsMap(rows);
    return shapeSettings(map);
  }

  async function updateSettings(payload) {
    await repository.upsertMany(toGeneralKeyValuePairs(payload));
    return getSettings();
  }

  async function getLoginAppearance() {
    const rows = await repository.getMany(LOGIN_APPEARANCE_KEYS);
    return shapeLoginAppearance(toSettingsMap(rows));
  }

  async function updateLoginAppearance(payload) {
    const current = await getLoginAppearance();
    const nextPayload = {
      heroTitle: payload.heroTitle || LOGIN_APPEARANCE_DEFAULTS.heroTitle,
      heroSubtitle: payload.heroSubtitle,
      heroEyebrow: payload.heroEyebrow,
      loginButtonText: payload.loginButtonText,
      backgroundImageUrl: payload.backgroundImageUrl ?? current.backgroundImageUrl,
      backgroundImageAlt: payload.backgroundImageAlt,
    };

    await repository.upsertMany(toLoginAppearanceKeyValuePairs(nextPayload));
    return getLoginAppearance();
  }

  async function getPublicLoginAppearance() {
    const appearance = await getLoginAppearance();

    return {
      heroTitle: appearance.heroTitle,
      heroSubtitle: appearance.heroSubtitle,
      heroEyebrow: appearance.heroEyebrow,
      loginButtonText: appearance.loginButtonText,
      backgroundImageUrl: appearance.backgroundImageUrl,
      backgroundImageAlt: appearance.backgroundImageAlt,
      updatedAt: appearance.updatedAt,
    };
  }

  async function saveLoginAppearanceBackground({ body, mimeType, originalName }) {
    const current = await getLoginAppearance();
    const { extension, safeStem } = validateUploadInput({
      body,
      mimeType,
      originalName,
    });

    const filename = `${Date.now()}-${safeStem}${extension}`;
    const publicPath = `${publicAssetPrefix}/${filename}`;
    const outputPath = path.join(storageRoot, filename);

    await repository.ensureStorageDir();
    await repository.writeFile(outputPath, body);
    await repository.upsertMany([
      { key: "login_appearance_background_image_url", value: publicPath },
    ]);

    if (current.backgroundImageUrl && current.backgroundImageUrl !== publicPath) {
      await repository.removeStoredBackgroundImage(current.backgroundImageUrl);
    }

    return {
      backgroundImageUrl: publicPath,
    };
  }

  async function restoreDefaultLoginAppearance() {
    const current = await getLoginAppearance();

    await repository.upsertMany(
      toLoginAppearanceKeyValuePairs({
        heroTitle: LOGIN_APPEARANCE_DEFAULTS.heroTitle,
        heroSubtitle: "",
        heroEyebrow: "",
        loginButtonText: "",
        backgroundImageUrl: "",
        backgroundImageAlt: "",
      }),
    );

    if (current.backgroundImageUrl) {
      await repository.removeStoredBackgroundImage(current.backgroundImageUrl);
    }

    return getLoginAppearance();
  }

  async function getClientPortalSettings() {
    const rows = await repository.getMany(GENERAL_KEYS);
    return shapeClientPortalSettings(toSettingsMap(rows));
  }

  async function getPublicPortalSettings() {
    const keys = [
      "public_portal_enabled",
      "public_portal_hero_title",
      "public_portal_hero_subtitle",
      "public_portal_hero_description",
      "public_portal_about_title",
      "public_portal_about_text",
      "public_portal_cta_label",
      "public_portal_cta_url",
      "public_portal_whatsapp",
      "public_portal_instagram",
      "public_portal_address",
      "public_portal_opening_hours_text",
      "public_portal_show_service_prices",
      "public_portal_show_product_prices",
      "public_portal_hero_image_url",
      "public_portal_logo_url",
    ];
    const rows = await repository.getMany(keys);
    const map = toSettingsMap(rows);

    return {
      enabled: map.public_portal_enabled !== "false",
      heroTitle: getPublicPortalString(map, "public_portal_hero_title", "Alphamen Barbearia"),
      heroSubtitle: getPublicPortalString(map, "public_portal_hero_subtitle", "Estilo é identidade."),
      heroDescription: getPublicPortalString(map, "public_portal_hero_description"),
      aboutTitle: getPublicPortalString(map, "public_portal_about_title"),
      aboutText: getPublicPortalString(map, "public_portal_about_text"),
      ctaLabel: getPublicPortalString(map, "public_portal_cta_label", "Agendar"),
      ctaUrl: getPublicPortalString(map, "public_portal_cta_url"),
      whatsapp: getPublicPortalString(map, "public_portal_whatsapp"),
      instagram: getPublicPortalString(map, "public_portal_instagram"),
      address: getPublicPortalString(map, "public_portal_address"),
      openingHoursText: getPublicPortalString(map, "public_portal_opening_hours_text"),
      showServicePrices: map.public_portal_show_service_prices !== "false",
      showProductPrices: map.public_portal_show_product_prices !== "false",
      heroImageUrl: getPublicPortalString(map, "public_portal_hero_image_url"),
      logoUrl: getPublicPortalString(map, "public_portal_logo_url"),
    };
  }

  async function updatePublicPortalSettings(payload) {
    const pairs = [
      { key: "public_portal_enabled", value: String(payload.enabled) },
      { key: "public_portal_hero_title", value: payload.heroTitle },
      { key: "public_portal_hero_subtitle", value: payload.heroSubtitle ?? "" },
      { key: "public_portal_hero_description", value: payload.heroDescription ?? "" },
      { key: "public_portal_about_title", value: payload.aboutTitle ?? "" },
      { key: "public_portal_about_text", value: payload.aboutText ?? "" },
      { key: "public_portal_cta_label", value: payload.ctaLabel ?? "" },
      { key: "public_portal_cta_url", value: payload.ctaUrl ?? "" },
      { key: "public_portal_whatsapp", value: payload.whatsapp ?? "" },
      { key: "public_portal_instagram", value: payload.instagram ?? "" },
      { key: "public_portal_address", value: payload.address ?? "" },
      { key: "public_portal_opening_hours_text", value: payload.openingHoursText ?? "" },
      { key: "public_portal_show_service_prices", value: String(payload.showServicePrices) },
      { key: "public_portal_show_product_prices", value: String(payload.showProductPrices) },
      { key: "public_portal_hero_image_url", value: payload.heroImageUrl ?? "" },
      { key: "public_portal_logo_url", value: payload.logoUrl ?? "" },
    ];
    
    await repository.upsertMany(pairs);
    return getPublicPortalSettings();
  }

  return {
    getSettings,
    updateSettings,
    getClientPortalSettings,
    getLoginAppearance,
    updateLoginAppearance,
    getPublicLoginAppearance,
    saveLoginAppearanceBackground,
    restoreDefaultLoginAppearance,
    getPublicPortalSettings,
    updatePublicPortalSettings,
  };
}

const settingsService = createSettingsService();

export const {
  getSettings,
  updateSettings,
  getClientPortalSettings,
  getLoginAppearance,
  updateLoginAppearance,
  getPublicLoginAppearance,
  saveLoginAppearanceBackground,
  restoreDefaultLoginAppearance,
  getPublicPortalSettings,
  updatePublicPortalSettings,
} = settingsService;

export {
  CLIENT_PORTAL_DEFAULTS,
  MAX_BACKGROUND_IMAGE_SIZE_BYTES,
  publicAssetPrefix,
  storageRoot,
};
