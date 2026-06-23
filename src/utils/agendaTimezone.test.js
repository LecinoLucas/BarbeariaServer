import assert from "node:assert/strict";
import test from "node:test";

import {
  AGENDA_TIME_ZONE,
  addMinutesUtc,
  assertBusinessDate,
  assertBusinessTime,
  combineBusinessDateAndTimeToUtc,
  getBusinessDateKeyFromUtc,
  getBusinessDayUtcRange,
  getBusinessTimeFromUtc,
  getWeekdayInBusinessZone,
} from "./agendaTimezone.js";

test("expõe o timezone padrão da agenda", () => {
  assert.equal(AGENDA_TIME_ZONE, "America/Sao_Paulo");
});

test("getBusinessDayUtcRange converte o dia local para a janela UTC correta", () => {
  const { startUtc, endUtc } = getBusinessDayUtcRange("2026-06-23");

  assert.equal(startUtc.toISOString(), "2026-06-23T03:00:00.000Z");
  assert.equal(endUtc.toISOString(), "2026-06-24T02:59:59.999Z");
});

test("combineBusinessDateAndTimeToUtc converte 09:00 local para UTC", () => {
  const utcDate = combineBusinessDateAndTimeToUtc("2026-06-23", "09:00");
  assert.equal(utcDate.toISOString(), "2026-06-23T12:00:00.000Z");
});

test("combineBusinessDateAndTimeToUtc converte 22:00 local para UTC", () => {
  const utcDate = combineBusinessDateAndTimeToUtc("2026-06-23", "22:00");
  assert.equal(utcDate.toISOString(), "2026-06-24T01:00:00.000Z");
});

test("combineBusinessDateAndTimeToUtc converte 22:30 local para UTC", () => {
  const utcDate = combineBusinessDateAndTimeToUtc("2026-06-23", "22:30");
  assert.equal(utcDate.toISOString(), "2026-06-24T01:30:00.000Z");
});

test("combineBusinessDateAndTimeToUtc converte 23:30 local para UTC", () => {
  const utcDate = combineBusinessDateAndTimeToUtc("2026-06-23", "23:30");
  assert.equal(utcDate.toISOString(), "2026-06-24T02:30:00.000Z");
});

test("getBusinessDateKeyFromUtc retorna a data local correta", () => {
  const businessDate = getBusinessDateKeyFromUtc(new Date("2026-06-24T01:30:00.000Z"));
  assert.equal(businessDate, "2026-06-23");
});

test("getBusinessTimeFromUtc retorna a hora local correta", () => {
  const businessTime = getBusinessTimeFromUtc(new Date("2026-06-24T01:30:00.000Z"));
  assert.equal(businessTime, "22:30");
});

test("getWeekdayInBusinessZone mantém compatibilidade com o padrão 0..6 atual", () => {
  assert.equal(getWeekdayInBusinessZone("2026-06-23"), 2);
  assert.equal(getWeekdayInBusinessZone("2026-06-28"), 0);
});

test("assertBusinessDate aceita datas válidas e rejeita inválidas", () => {
  assert.equal(assertBusinessDate("2026-06-23"), "2026-06-23");
  assert.throws(() => assertBusinessDate("2026-02-31"), /Data de negócio inválida/);
  assert.throws(() => assertBusinessDate("2026-13-01"), /Data de negócio inválida/);
  assert.throws(() => assertBusinessDate("abc"), /Data de negócio inválida/);
});

test("assertBusinessTime aceita horários válidos e rejeita inválidos", () => {
  assert.equal(assertBusinessTime("22:30"), "22:30");
  assert.throws(() => assertBusinessTime("24:00"), /Horário de negócio inválido/);
  assert.throws(() => assertBusinessTime("99:99"), /Horário de negócio inválido/);
  assert.throws(() => assertBusinessTime("abc"), /Horário de negócio inválido/);
});

test("addMinutesUtc soma minutos sem mutar a data original", () => {
  const original = new Date("2026-06-24T01:30:00.000Z");
  const originalTime = original.getTime();

  const result = addMinutesUtc(original, 30);

  assert.equal(original.getTime(), originalTime);
  assert.equal(result.toISOString(), "2026-06-24T02:00:00.000Z");
  assert.notEqual(result, original);
});
