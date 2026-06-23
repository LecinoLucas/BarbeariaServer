import assert from "node:assert/strict";
import test from "node:test";

import { ValidationError } from "../../errors/ValidationError.js";
import { validateRescheduleAppointment } from "./appointment.validator.js";

test("validateRescheduleAppointment rejeita payload vazio", () => {
  assert.throws(
    () => validateRescheduleAppointment({}),
    (error) => error instanceof ValidationError,
  );
});

test("validateRescheduleAppointment rejeita data inválida", () => {
  assert.throws(
    () =>
      validateRescheduleAppointment({
        date: "2026-02-31",
        time: "10:00",
      }),
    (error) => {
      assert.equal(error instanceof ValidationError, true);
      return true;
    },
  );
});

test("validateRescheduleAppointment rejeita horário inválido", () => {
  assert.throws(
    () =>
      validateRescheduleAppointment({
        date: "2026-06-23",
        time: "24:00",
      }),
    (error) => {
      assert.equal(error instanceof ValidationError, true);
      return true;
    },
  );
});

test("validateRescheduleAppointment aceita professionalId opcional e preserva payload válido", () => {
  const result = validateRescheduleAppointment({
    date: "2026-06-23",
    time: "22:30",
    professionalId: "pro-1",
  });

  assert.deepEqual(result, {
    date: "2026-06-23",
    time: "22:30",
    professionalId: "pro-1",
  });
});
