import assert from "node:assert/strict";
import test from "node:test";

import { calculateAttendanceTotal, calculateAttendanceTotals } from "./attendance.utils.js";
import { validateAddAttendanceProduct, validateUpdateAttendanceProduct } from "./attendance.validator.js";
import { ValidationError } from "../../errors/ValidationError.js";

test("calculateAttendanceTotal soma serviço, itens e produtos em centavos", () => {
  const total = calculateAttendanceTotal({
    appointment: { service: { price: 50 } },
    items: [{ total: 10 }],
    productItems: [{ totalPriceCents: 7000 }],
  });
  assert.equal(total, 130);
});

test("calculateAttendanceTotals centraliza componentes financeiros sem ponto flutuante", () => {
  const totals = calculateAttendanceTotals({
    appointment: { service: { price: 50 } },
    items: [{ total: 10.25 }],
    productItems: [{ totalPriceCents: 6999 }],
  });

  assert.deepEqual(totals, {
    serviceTotalCents: 5000,
    itemsTotalCents: 1025,
    productTotalCents: 6999,
    grandTotalCents: 13024,
  });
  assert.equal(calculateAttendanceTotal({ appointment: { service: { price: 50 } }, items: [{ total: 10.25 }], productItems: [{ totalPriceCents: 6999 }] }), 130.24);
});

test("validação de produto no atendimento rejeita quantidade inválida", () => {
  for (const quantity of [0, -1, 1.5, 1000]) {
    assert.throws(() => validateAddAttendanceProduct({ productId: "product-1", quantity }), ValidationError);
  }
  assert.throws(() => validateUpdateAttendanceProduct({ quantity: 0 }), ValidationError);
});
