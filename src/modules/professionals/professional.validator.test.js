import assert from "node:assert/strict";
import test from "node:test";

import {
  validateCreateProfessional,
  validateUpdateProfessional,
} from "./professional.validator.js";

// ─── helpers ──────────────────────────────────────────────────────────────────

function baseCreate(overrides = {}) {
  return { name: "Carlos Mendes", status: "ACTIVE", ...overrides };
}

function baseUpdate(overrides = {}) {
  return { name: "Carlos Mendes", status: "ACTIVE", ...overrides };
}

// ─── create — appointmentIntervalMinutes ──────────────────────────────────────

test("cria profissional sem appointmentIntervalMinutes → null", () => {
  const result = validateCreateProfessional(baseCreate());
  assert.equal(result.appointmentIntervalMinutes, null);
});

test("cria profissional com appointmentIntervalMinutes null → null", () => {
  const result = validateCreateProfessional(baseCreate({ appointmentIntervalMinutes: null }));
  assert.equal(result.appointmentIntervalMinutes, null);
});

test("cria profissional com string vazia → null", () => {
  const result = validateCreateProfessional(baseCreate({ appointmentIntervalMinutes: "" }));
  assert.equal(result.appointmentIntervalMinutes, null);
});

test("cria profissional com intervalo numérico válido", () => {
  const result = validateCreateProfessional(baseCreate({ appointmentIntervalMinutes: 30 }));
  assert.equal(result.appointmentIntervalMinutes, 30);
});

test("cria profissional com intervalo como string numérica", () => {
  const result = validateCreateProfessional(baseCreate({ appointmentIntervalMinutes: "15" }));
  assert.equal(result.appointmentIntervalMinutes, 15);
});

test("cria profissional com intervalo 1 (mínimo)", () => {
  const result = validateCreateProfessional(baseCreate({ appointmentIntervalMinutes: 1 }));
  assert.equal(result.appointmentIntervalMinutes, 1);
});

test("cria profissional com intervalo 480 (máximo)", () => {
  const result = validateCreateProfessional(baseCreate({ appointmentIntervalMinutes: 480 }));
  assert.equal(result.appointmentIntervalMinutes, 480);
});

test("rejeita intervalo zero no create", () => {
  assert.throws(() => validateCreateProfessional(baseCreate({ appointmentIntervalMinutes: 0 })));
});

test("rejeita intervalo negativo no create", () => {
  assert.throws(() => validateCreateProfessional(baseCreate({ appointmentIntervalMinutes: -15 })));
});

test("rejeita intervalo decimal no create", () => {
  assert.throws(() => validateCreateProfessional(baseCreate({ appointmentIntervalMinutes: 10.5 })));
});

test("rejeita intervalo acima do máximo no create", () => {
  assert.throws(() => validateCreateProfessional(baseCreate({ appointmentIntervalMinutes: 481 })));
});

test("rejeita texto inválido no intervalo no create", () => {
  assert.throws(() => validateCreateProfessional(baseCreate({ appointmentIntervalMinutes: "abc" })));
});

// ─── update — appointmentIntervalMinutes ──────────────────────────────────────

test("atualiza profissional sem appointmentIntervalMinutes → null (padrão do projeto: campos opcionais omitidos viram null no update)", () => {
  const result = validateUpdateProfessional(baseUpdate());
  assert.equal(result.appointmentIntervalMinutes, null);
});

test("atualiza profissional removendo intervalo próprio (null → null)", () => {
  const result = validateUpdateProfessional(baseUpdate({ appointmentIntervalMinutes: null }));
  assert.equal(result.appointmentIntervalMinutes, null);
});

test("atualiza profissional removendo intervalo com string vazia → null", () => {
  const result = validateUpdateProfessional(baseUpdate({ appointmentIntervalMinutes: "" }));
  assert.equal(result.appointmentIntervalMinutes, null);
});

test("atualiza profissional adicionando intervalo válido", () => {
  const result = validateUpdateProfessional(baseUpdate({ appointmentIntervalMinutes: 45 }));
  assert.equal(result.appointmentIntervalMinutes, 45);
});

test("rejeita intervalo zero no update", () => {
  assert.throws(() => validateUpdateProfessional(baseUpdate({ appointmentIntervalMinutes: 0 })));
});

test("rejeita intervalo negativo no update", () => {
  assert.throws(() => validateUpdateProfessional(baseUpdate({ appointmentIntervalMinutes: -1 })));
});

test("rejeita decimal no update", () => {
  assert.throws(() => validateUpdateProfessional(baseUpdate({ appointmentIntervalMinutes: 30.5 })));
});

test("rejeita texto inválido no update", () => {
  assert.throws(() => validateUpdateProfessional(baseUpdate({ appointmentIntervalMinutes: "texto" })));
});
