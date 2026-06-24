import assert from "node:assert/strict";
import test from "node:test";
import { getPublicPortal, getPublicProducts, getPublicServices } from "./public.service.js";

function buildDeps(overrides = {}) {
  const calls = {
    getMany: [],
    listPublicServices: [],
    countPublicServices: [],
    listPublicProducts: [],
    countPublicProducts: [],
  };

  const deps = {
    async getMany(keys) {
      calls.getMany.push(keys);
      if (overrides.getMany) return overrides.getMany(keys);
      return [];
    },
    async listPublicServices(args) {
      calls.listPublicServices.push(args);
      if (overrides.listPublicServices) return overrides.listPublicServices(args);
      return [];
    },
    async countPublicServices() {
      calls.countPublicServices.push();
      if (overrides.countPublicServices) return overrides.countPublicServices();
      return 0;
    },
    async listPublicProducts(args) {
      calls.listPublicProducts.push(args);
      if (overrides.listPublicProducts) return overrides.listPublicProducts(args);
      return [];
    },
    async countPublicProducts() {
      calls.countPublicProducts.push();
      if (overrides.countPublicProducts) return overrides.countPublicProducts();
      return 0;
    },
  };

  return { deps, calls };
}

test("getPublicPortal returns defaults when no settings exist", async () => {
  const { deps } = buildDeps();
  const portal = await getPublicPortal(deps);

  assert.equal(portal.barbershopName, "Alphamen Barbearia");
  assert.equal(portal.enabled, true);
  assert.equal(portal.heroTitle, "Alphamen Barbearia");
  assert.equal(portal.showServicePrices, true);
  assert.equal(portal.showProductPrices, true);
  assert.equal(portal.ctaLabel, "Agendar");
});

test("getPublicPortal returns mapped settings", async () => {
  const { deps } = buildDeps({
    getMany: () => [
      { key: "barbershop_name", value: "Minha Barbearia" },
      { key: "public_portal_enabled", value: "false" },
      { key: "public_portal_hero_title", value: "Bem-vindo" },
      { key: "public_portal_show_service_prices", value: "false" },
    ],
  });
  const portal = await getPublicPortal(deps);

  assert.equal(portal.barbershopName, "Minha Barbearia");
  assert.equal(portal.enabled, false);
  assert.equal(portal.heroTitle, "Bem-vindo");
  assert.equal(portal.showServicePrices, false);
  assert.equal(portal.internalNotes, undefined);
});

test("getPublicPortal returns only public-facing fields", async () => {
  const { deps } = buildDeps({
    getMany: () => [
      { key: "barbershop_name", value: "Minha Barbearia" },
      { key: "public_portal_whatsapp", value: "5511999999999" },
      { key: "public_portal_opening_hours_text", value: "Seg a sáb, 09h às 18h" },
    ],
  });

  const portal = await getPublicPortal(deps);

  assert.deepEqual(Object.keys(portal).sort(), [
    "aboutText",
    "aboutTitle",
    "address",
    "barbershopName",
    "ctaLabel",
    "ctaUrl",
    "enabled",
    "heroDescription",
    "heroImageUrl",
    "heroSubtitle",
    "heroTitle",
    "instagram",
    "logoUrl",
    "openingHoursText",
    "showProductPrices",
    "showServicePrices",
    "whatsapp",
  ]);
});

test("getPublicServices returns items and meta", async () => {
  const { deps } = buildDeps({
    listPublicServices: () => [
      { id: "1", name: "Corte", durationMinutes: 30, price: "50.00" },
    ],
    countPublicServices: () => 1,
  });

  const result = await getPublicServices({ page: 1, limit: 10 }, deps);

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].name, "Corte");
  assert.equal(result.items[0].priceCents, 5000);
  assert.equal(result.meta.total, 1);
  assert.equal(result.meta.totalPages, 1);
  assert.equal(result.meta.page, 1);
  assert.equal(result.meta.limit, 10);
});

test("getPublicServices hides prices if configured", async () => {
  const { deps } = buildDeps({
    getMany: (keys) => {
      if (keys.includes("public_portal_show_service_prices")) {
        return [{ key: "public_portal_show_service_prices", value: "false" }];
      }
      return [];
    },
    listPublicServices: () => [
      { id: "1", name: "Corte", durationMinutes: 30, price: "50.00" },
    ],
    countPublicServices: () => 1,
  });

  const result = await getPublicServices({ page: 1, limit: 10 }, deps);

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].name, "Corte");
  assert.equal(result.items[0].priceCents, undefined);
});

test("getPublicProducts returns items without costCents", async () => {
  const { deps } = buildDeps({
    listPublicProducts: () => [
      { id: "1", name: "Pomada", sku: "POM-1", priceCents: 4500, costCents: 2000 },
    ],
    countPublicProducts: () => 1,
  });

  const result = await getPublicProducts({ page: 1, limit: 10 }, deps);

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].name, "Pomada");
  assert.equal(result.items[0].priceCents, 4500);
  assert.equal(result.items[0].costCents, undefined);
  assert.equal(result.meta.total, 1);
});

test("getPublicProducts hides prices if configured", async () => {
  const { deps } = buildDeps({
    getMany: (keys) => {
      if (keys.includes("public_portal_show_product_prices")) {
        return [{ key: "public_portal_show_product_prices", value: "false" }];
      }
      return [];
    },
    listPublicProducts: () => [
      { id: "1", name: "Pomada", sku: "POM-1", priceCents: 4500 },
    ],
    countPublicProducts: () => 1,
  });

  const result = await getPublicProducts({ page: 1, limit: 10 }, deps);

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].priceCents, undefined);
});
