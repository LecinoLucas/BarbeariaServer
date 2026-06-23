import assert from "node:assert/strict";
import test from "node:test";

import prisma from "../../database/prisma.js";
import { count, list } from "./payment.repository.js";

test("list e count compõem search com status, paymentMethodId e período via AND", async (t) => {
  const originalFindMany = prisma.payment.findMany;
  const originalCount = prisma.payment.count;
  const calls = [];

  t.after(() => {
    prisma.payment.findMany = originalFindMany;
    prisma.payment.count = originalCount;
  });

  prisma.payment.findMany = async (args) => {
    calls.push(args);
    return [];
  };
  prisma.payment.count = async (args) => {
    calls.push(args);
    return 0;
  };

  const filters = {
    page: 1,
    limit: 10,
    search: "ana",
    status: "PAID",
    paymentMethodId: "pm-1",
    startDate: "2026-06-01",
    endDate: "2026-06-15",
  };

  await list(filters);
  await count(filters);

  assert.equal(calls.length, 2);

  for (const call of calls) {
    assert.equal(call.where.status, "PAID");
    assert.equal(call.where.paymentMethodId, "pm-1");
    assert.equal(call.where.AND.length, 2);

    const [searchCondition, dateCondition] = call.where.AND;

    assert.equal(searchCondition.OR.some((item) => item.attendance?.client?.name?.contains === "ana"), true);
    assert.deepEqual(dateCondition, {
      OR: [
        {
          status: "PAID",
          paidAt: {
            gte: new Date("2026-06-01T00:00:00.000Z"),
            lte: new Date("2026-06-15T23:59:59.999Z"),
          },
        },
        {
          status: "PAID",
          paidAt: null,
          createdAt: {
            gte: new Date("2026-06-01T00:00:00.000Z"),
            lte: new Date("2026-06-15T23:59:59.999Z"),
          },
        },
        {
          status: {
            in: ["PENDING", "CANCELED"],
          },
          createdAt: {
            gte: new Date("2026-06-01T00:00:00.000Z"),
            lte: new Date("2026-06-15T23:59:59.999Z"),
          },
        },
      ],
    });
  }
});

test("search vazio ou undefined não adiciona where.AND", async (t) => {
  const originalFindMany = prisma.payment.findMany;
  const captured = [];

  t.after(() => {
    prisma.payment.findMany = originalFindMany;
  });

  prisma.payment.findMany = async (args) => {
    captured.push(args);
    return [];
  };

  await list({
    page: 1,
    limit: 10,
    status: "PENDING",
    search: "",
  });

  await list({
    page: 1,
    limit: 10,
    status: "PENDING",
    search: undefined,
  });

  assert.equal(captured.length, 2);

  for (const call of captured) {
    assert.equal(call.where.status, "PENDING");
    assert.equal("AND" in call.where, false);
  }
});
