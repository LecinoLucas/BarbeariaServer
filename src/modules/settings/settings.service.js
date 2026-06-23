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
};

const LOGIN_APPEARANCE_KEYS = [
  "login_appearance_hero_title",
  "login_appearance_hero_subtitle",
  "login_appearance_hero_eyebrow",
  "login_appearance_button_text",
  "login_appearance_background_image_url",
  "login_appearance_background_image_alt",
];

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
  ];
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

  return {
    getSettings,
    updateSettings,
    getLoginAppearance,
    updateLoginAppearance,
    getPublicLoginAppearance,
    saveLoginAppearanceBackground,
    restoreDefaultLoginAppearance,
  };
}

const settingsService = createSettingsService();

export const {
  getSettings,
  updateSettings,
  getLoginAppearance,
  updateLoginAppearance,
  getPublicLoginAppearance,
  saveLoginAppearanceBackground,
  restoreDefaultLoginAppearance,
} = settingsService;

export { MAX_BACKGROUND_IMAGE_SIZE_BYTES, publicAssetPrefix, storageRoot };
