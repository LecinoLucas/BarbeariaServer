import { getMany, upsertMany } from "./settings.repository.js";

const ALL_KEYS = [
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
];

const DEFAULTS = {
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
};

function toSettingsMap(rows) {
  const map = {};
  for (const row of rows) map[row.key] = row.value;
  return map;
}

function shapeSettings(map) {
  const get = (key) => map[key] ?? DEFAULTS[key];

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
  };
}

function toKeyValuePairs(payload) {
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
  ];
}

export async function getSettings() {
  const rows = await getMany(ALL_KEYS);
  const map = toSettingsMap(rows);
  return shapeSettings(map);
}

export async function updateSettings(payload) {
  const pairs = toKeyValuePairs(payload);
  await upsertMany(pairs);
  return getSettings();
}
