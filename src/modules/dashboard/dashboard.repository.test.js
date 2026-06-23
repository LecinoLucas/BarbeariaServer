import assert from "node:assert/strict";
import test from "node:test";

import prisma from "../../database/prisma.js";
import { getBusyHours } from "./dashboard.repository.js";

const START_OF_MONTH = new Date("2026-06-01T03:00:00.000Z");
const END_OF_MONTH = new Date("2026-07-01T03:00:00.000Z");

function patchQueryRaw(t, returnValue = []) {
  const original = prisma.$queryRaw;
  const calls = [];

  t.after(() => {
    prisma.$queryRaw = original;
  });

  prisma.$queryRaw = async (query) => {
    calls.push(query);
    return returnValue;
  };

  return calls;
}

test("getBusyHours usa AT TIME ZONE America/Sao_Paulo na extração da hora", async (t) => {
  const calls = patchQueryRaw(t);

  await getBusyHours({ startOfMonth: START_OF_MONTH, endOfMonth: END_OF_MONTH });

  assert.equal(calls.length, 1);
  const { sql, values } = calls[0];

  assert.ok(sql.includes("AT TIME ZONE ?"), "SQL deve usar AT TIME ZONE com parâmetro");
  assert.ok(values.includes("America/Sao_Paulo"), "America/Sao_Paulo deve estar nos valores");
  assert.ok(!sql.includes("SELECT *"), "SQL não deve usar SELECT *");
});

test("getBusyHours: AT TIME ZONE aparece no SELECT e no GROUP BY", async (t) => {
  const calls = patchQueryRaw(t);

  await getBusyHours({ startOfMonth: START_OF_MONTH, endOfMonth: END_OF_MONTH });

  const { sql, values } = calls[0];

  const occurrences = (sql.match(/AT TIME ZONE \?/g) ?? []).length;
  assert.equal(occurrences, 2, "AT TIME ZONE deve aparecer no SELECT e no GROUP BY");

  const tzValues = values.filter((v) => v === "America/Sao_Paulo");
  assert.equal(tzValues.length, 2, "America/Sao_Paulo deve aparecer 2 vezes nos valores");
});

test("getBusyHours: startOfMonth e endOfMonth são passados como parâmetros da query", async (t) => {
  const calls = patchQueryRaw(t);

  await getBusyHours({ startOfMonth: START_OF_MONTH, endOfMonth: END_OF_MONTH });

  const { values } = calls[0];

  assert.ok(
    values.some((v) => v instanceof Date && v.toISOString() === START_OF_MONTH.toISOString()),
    "startOfMonth deve estar nos parâmetros",
  );
  assert.ok(
    values.some((v) => v instanceof Date && v.toISOString() === END_OF_MONTH.toISOString()),
    "endOfMonth deve estar nos parâmetros",
  );
});

test("getBusyHours repassa o resultado bruto da query ao chamador", async (t) => {
  const fakeResult = [
    { hour: "09:00", appointments: 5 },
    { hour: "10:00", appointments: 3 },
  ];
  patchQueryRaw(t, fakeResult);

  const result = await getBusyHours({ startOfMonth: START_OF_MONTH, endOfMonth: END_OF_MONTH });

  assert.deepEqual(result, fakeResult);
});
