import assert from "node:assert/strict";
import test from "node:test";

import prisma from "../../database/prisma.js";
import {
  cancel,
  count,
  create,
  findById,
  getMonthExpensesCents,
  list,
  update,
} from "./expense.repository.js";

function buildExpenseData(overrides = {}) {
  return {
    description: "Aluguel do espaço",
    amountCents: 150000,
    category: "Aluguel",
    expenseDate: new Date("2026-06-01T00:00:00.000Z"),
    notes: null,
    createdByUserId: null,
    ...overrides,
  };
}

// ─── create ────────────────────────────────────────────────────────────────

test("create armazena campos corretos com status ACTIVE", async (t) => {
  const originalCreate = prisma.expense.create;
  const calls = [];

  t.after(() => {
    prisma.expense.create = originalCreate;
  });

  prisma.expense.create = async (args) => {
    calls.push(args);
    return { id: "exp-1", ...args.data, status: "ACTIVE", createdAt: new Date(), updatedAt: new Date() };
  };

  const data = buildExpenseData();
  await create(data);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].data.description, "Aluguel do espaço");
  assert.equal(calls[0].data.amountCents, 150000);
  assert.equal(calls[0].data.category, "Aluguel");
});

// ─── list ──────────────────────────────────────────────────────────────────

test("list usa skip/take corretos para paginação", async (t) => {
  const originalFindMany = prisma.expense.findMany;
  const calls = [];

  t.after(() => {
    prisma.expense.findMany = originalFindMany;
  });

  prisma.expense.findMany = async (args) => {
    calls.push(args);
    return [];
  };

  await list({ page: 2, limit: 10 });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].skip, 10);
  assert.equal(calls[0].take, 10);
});

test("list filtra por status quando informado", async (t) => {
  const originalFindMany = prisma.expense.findMany;
  const calls = [];

  t.after(() => {
    prisma.expense.findMany = originalFindMany;
  });

  prisma.expense.findMany = async (args) => {
    calls.push(args);
    return [];
  };

  await list({ page: 1, limit: 20, status: "CANCELED" });

  assert.equal(calls[0].where.status, "CANCELED");
});

test("list não filtra por status quando ausente", async (t) => {
  const originalFindMany = prisma.expense.findMany;
  const calls = [];

  t.after(() => {
    prisma.expense.findMany = originalFindMany;
  });

  prisma.expense.findMany = async (args) => {
    calls.push(args);
    return [];
  };

  await list({ page: 1, limit: 20 });

  assert.equal(calls[0].where.status, undefined);
});

test("list filtra por startDate e endDate quando informados", async (t) => {
  const originalFindMany = prisma.expense.findMany;
  const calls = [];

  t.after(() => {
    prisma.expense.findMany = originalFindMany;
  });

  prisma.expense.findMany = async (args) => {
    calls.push(args);
    return [];
  };

  await list({ page: 1, limit: 20, startDate: "2026-06-01", endDate: "2026-06-30" });

  assert.ok(calls[0].where.expenseDate?.gte, "deve ter gte");
  assert.ok(calls[0].where.expenseDate?.lte, "deve ter lte");
  assert.equal(
    calls[0].where.expenseDate.gte.toISOString(),
    "2026-06-01T00:00:00.000Z",
  );
  assert.equal(
    calls[0].where.expenseDate.lte.toISOString(),
    "2026-06-30T23:59:59.999Z",
  );
});

test("list ordena por expenseDate desc, id desc", async (t) => {
  const originalFindMany = prisma.expense.findMany;
  const calls = [];

  t.after(() => {
    prisma.expense.findMany = originalFindMany;
  });

  prisma.expense.findMany = async (args) => {
    calls.push(args);
    return [];
  };

  await list({ page: 1, limit: 20 });

  assert.deepEqual(calls[0].orderBy, [{ expenseDate: "desc" }, { id: "desc" }]);
});

// ─── cancel ────────────────────────────────────────────────────────────────

test("cancel define status CANCELED no registro", async (t) => {
  const originalUpdate = prisma.expense.update;
  const calls = [];

  t.after(() => {
    prisma.expense.update = originalUpdate;
  });

  prisma.expense.update = async (args) => {
    calls.push(args);
    return { id: args.where.id, status: "CANCELED" };
  };

  await cancel("exp-1");

  assert.equal(calls.length, 1);
  assert.equal(calls[0].where.id, "exp-1");
  assert.equal(calls[0].data.status, "CANCELED");
});

// ─── getMonthExpensesCents ─────────────────────────────────────────────────

test("getMonthExpensesCents agrega apenas despesas ACTIVE no período", async (t) => {
  const originalAggregate = prisma.expense.aggregate;
  const calls = [];

  t.after(() => {
    prisma.expense.aggregate = originalAggregate;
  });

  prisma.expense.aggregate = async (args) => {
    calls.push(args);
    return { _sum: { amountCents: 300000 } };
  };

  const startOfMonth = new Date("2026-06-01T00:00:00.000Z");
  const endOfMonth = new Date("2026-07-01T00:00:00.000Z");

  const result = await getMonthExpensesCents({ startOfMonth, endOfMonth });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].where.status, "ACTIVE");
  assert.equal(calls[0].where.deletedAt, null);
  assert.equal(calls[0].where.expenseDate.gte.toISOString(), "2026-06-01T00:00:00.000Z");
  assert.equal(calls[0].where.expenseDate.lt.toISOString(), "2026-07-01T00:00:00.000Z");
  assert.equal(result, 300000);
});

test("getMonthExpensesCents retorna 0 quando não há despesas", async (t) => {
  const originalAggregate = prisma.expense.aggregate;

  t.after(() => {
    prisma.expense.aggregate = originalAggregate;
  });

  prisma.expense.aggregate = async () => ({ _sum: { amountCents: null } });

  const result = await getMonthExpensesCents({
    startOfMonth: new Date("2026-06-01T00:00:00.000Z"),
    endOfMonth: new Date("2026-07-01T00:00:00.000Z"),
  });

  assert.equal(result, 0);
});

test("getMonthExpensesCents usa filtro de período correto para exclusão", async (t) => {
  const originalAggregate = prisma.expense.aggregate;
  const calls = [];

  t.after(() => {
    prisma.expense.aggregate = originalAggregate;
  });

  prisma.expense.aggregate = async (args) => {
    calls.push(args);
    return { _sum: { amountCents: 0 } };
  };

  await getMonthExpensesCents({
    startOfMonth: new Date("2026-05-01T00:00:00.000Z"),
    endOfMonth: new Date("2026-06-01T00:00:00.000Z"),
  });

  assert.equal(calls[0].where.expenseDate.gte.toISOString(), "2026-05-01T00:00:00.000Z");
  assert.equal(calls[0].where.expenseDate.lt.toISOString(), "2026-06-01T00:00:00.000Z");
});

// ─── select explícito ──────────────────────────────────────────────────────

test("findById usa select explícito sem campos sensíveis", async (t) => {
  const originalFindFirst = prisma.expense.findFirst;
  const calls = [];

  t.after(() => {
    prisma.expense.findFirst = originalFindFirst;
  });

  prisma.expense.findFirst = async (args) => {
    calls.push(args);
    return null;
  };

  await findById("exp-1");

  assert.equal(calls.length, 1);
  assert.ok(calls[0].select, "deve ter select explícito");
  assert.equal(calls[0].select.createdByUserId, undefined, "não deve expor createdByUserId");
  assert.equal(calls[0].select.deletedAt, undefined, "não deve expor deletedAt");
  assert.ok(calls[0].select.amountCents, "deve incluir amountCents");
  assert.ok(calls[0].select.description, "deve incluir description");
  assert.ok(calls[0].select.status, "deve incluir status");
});
