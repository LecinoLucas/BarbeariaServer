import { getMany } from "../settings/settings.repository.js";
import {
  countPublicProducts,
  countPublicServices,
  listPublicProducts,
  listPublicServices,
} from "./public.repository.js";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

const PUBLIC_PORTAL_KEYS = [
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
  "barbershop_name",
];

const PUBLIC_PORTAL_DEFAULTS = {
  enabled: true,
  heroTitle: "Alphamen Barbearia",
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
  showServicePrices: true,
  showProductPrices: true,
  heroImageUrl: null,
  logoUrl: null,
};

function toSettingsMap(rows) {
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

function get(map, key, fallback = null) {
  const value = map[key];
  if (typeof value !== "string" || value.trim() === "") return fallback;
  return value.trim();
}

function getBool(map, key, fallback = true) {
  const value = map[key];
  if (typeof value !== "string") return fallback;
  return value.trim() !== "false";
}

function resolveLimit(rawLimit) {
  const parsed = Number.parseInt(String(rawLimit ?? DEFAULT_LIMIT), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, MAX_LIMIT) : DEFAULT_LIMIT;
}

function resolvePage(rawPage) {
  const parsed = Number.parseInt(String(rawPage ?? 1), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export async function getPublicPortal(deps = {}) {
  const repository = deps.getMany ?? getMany;
  const rows = await repository(PUBLIC_PORTAL_KEYS);
  const map = toSettingsMap(rows);

  return {
    barbershopName: get(map, "barbershop_name", PUBLIC_PORTAL_DEFAULTS.heroTitle),
    enabled: getBool(map, "public_portal_enabled", PUBLIC_PORTAL_DEFAULTS.enabled),
    heroTitle: get(map, "public_portal_hero_title", PUBLIC_PORTAL_DEFAULTS.heroTitle),
    heroSubtitle: get(map, "public_portal_hero_subtitle", PUBLIC_PORTAL_DEFAULTS.heroSubtitle),
    heroDescription: get(map, "public_portal_hero_description"),
    aboutTitle: get(map, "public_portal_about_title"),
    aboutText: get(map, "public_portal_about_text"),
    ctaLabel: get(map, "public_portal_cta_label", PUBLIC_PORTAL_DEFAULTS.ctaLabel),
    ctaUrl: get(map, "public_portal_cta_url"),
    whatsapp: get(map, "public_portal_whatsapp"),
    instagram: get(map, "public_portal_instagram"),
    address: get(map, "public_portal_address"),
    openingHoursText: get(map, "public_portal_opening_hours_text"),
    showServicePrices: getBool(map, "public_portal_show_service_prices", PUBLIC_PORTAL_DEFAULTS.showServicePrices),
    showProductPrices: getBool(map, "public_portal_show_product_prices", PUBLIC_PORTAL_DEFAULTS.showProductPrices),
    heroImageUrl: get(map, "public_portal_hero_image_url"),
    logoUrl: get(map, "public_portal_logo_url"),
  };
}

export async function getPublicServices(query = {}, deps = {}) {
  const repo = {
    listPublicServices: deps.listPublicServices ?? listPublicServices,
    countPublicServices: deps.countPublicServices ?? countPublicServices,
    getMany: deps.getMany ?? getMany,
  };

  const limit = resolveLimit(query.limit);
  const page = resolvePage(query.page);
  const offset = (page - 1) * limit;

  // Check if prices should be shown
  const rows = await repo.getMany(["public_portal_show_service_prices"]);
  const map = toSettingsMap(rows);
  const showPrices = getBool(map, "public_portal_show_service_prices", true);

  const [items, total] = await Promise.all([
    repo.listPublicServices({ limit, offset }),
    repo.countPublicServices(),
  ]);

  return {
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description ?? null,
      durationMinutes: item.durationMinutes,
      ...(showPrices ? { priceCents: item.price ? Math.round(Number(item.price) * 100) : null } : {}),
    })),
    meta: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}

export async function getPublicProducts(query = {}, deps = {}) {
  const repo = {
    listPublicProducts: deps.listPublicProducts ?? listPublicProducts,
    countPublicProducts: deps.countPublicProducts ?? countPublicProducts,
    getMany: deps.getMany ?? getMany,
  };

  const limit = resolveLimit(query.limit);
  const page = resolvePage(query.page);
  const offset = (page - 1) * limit;

  // Check if prices should be shown
  const rows = await repo.getMany(["public_portal_show_product_prices"]);
  const map = toSettingsMap(rows);
  const showPrices = getBool(map, "public_portal_show_product_prices", true);

  const [items, total] = await Promise.all([
    repo.listPublicProducts({ limit, offset }),
    repo.countPublicProducts(),
  ]);

  return {
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description ?? null,
      sku: item.sku ?? null,
      // NOTE: costCents is NEVER exposed here — we only expose priceCents conditionally
      ...(showPrices ? { priceCents: item.priceCents ?? null } : {}),
    })),
    meta: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}
