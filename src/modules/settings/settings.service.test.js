import assert from "node:assert/strict";
import test from "node:test";

import { ValidationError } from "../../errors/ValidationError.js";
import {
  LOGIN_APPEARANCE_DEFAULTS,
  createSettingsService,
} from "./settings.service.js";
import { validateLoginAppearance } from "./settings.validator.js";

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
