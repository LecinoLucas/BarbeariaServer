import prisma from "../../database/prisma.js";

const expenseSelect = {
  id: true,
  description: true,
  amountCents: true,
  category: true,
  expenseDate: true,
  status: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
};

function buildWhere(filters) {
  const where = { deletedAt: null };

  if (filters.status) where.status = filters.status;
  if (filters.category) where.category = { equals: filters.category, mode: "insensitive" };

  if (filters.search) {
    where.description = { contains: filters.search, mode: "insensitive" };
  }

  if (filters.startDate || filters.endDate) {
    where.expenseDate = {};
    if (filters.startDate) {
      where.expenseDate.gte = new Date(`${filters.startDate}T00:00:00.000Z`);
    }
    if (filters.endDate) {
      where.expenseDate.lte = new Date(`${filters.endDate}T23:59:59.999Z`);
    }
  }

  return where;
}

export function create(data) {
  return prisma.expense.create({ data, select: expenseSelect });
}

export function findById(id) {
  if (!id) return null;
  return prisma.expense.findFirst({
    where: { id, deletedAt: null },
    select: expenseSelect,
  });
}

export function list(filters) {
  return prisma.expense.findMany({
    where: buildWhere(filters),
    orderBy: [{ expenseDate: "desc" }, { id: "desc" }],
    skip: (filters.page - 1) * filters.limit,
    take: filters.limit,
    select: expenseSelect,
  });
}

export function count(filters) {
  return prisma.expense.count({ where: buildWhere(filters) });
}

export function update(id, data) {
  return prisma.expense.update({ where: { id }, data, select: expenseSelect });
}

export function cancel(id) {
  return prisma.expense.update({
    where: { id },
    data: { status: "CANCELED" },
    select: expenseSelect,
  });
}

export async function getMonthExpensesCents({ startOfMonth, endOfMonth }) {
  const result = await prisma.expense.aggregate({
    _sum: { amountCents: true },
    where: {
      status: "ACTIVE",
      deletedAt: null,
      expenseDate: {
        gte: startOfMonth,
        lt: endOfMonth,
      },
    },
  });
  return Number(result._sum.amountCents ?? 0);
}
