import prisma from "../../database/prisma.js";
import { PAYMENT_METHODS } from "../../constants/paymentMethods.js";
import { PAYMENT_STATUS } from "../../constants/paymentStatus.js";

const paymentAttendanceSelect = {
  id: true,
  status: true,
  startedAt: true,
  finishedAt: true,
  appointment: {
    select: {
      id: true,
      startAt: true,
      endAt: true,
      status: true,
      service: {
        select: {
          id: true,
          name: true,
          price: true,
        },
      },
    },
  },
  client: { select: { id: true, name: true } },
  professional: { select: { id: true, name: true } },
  items: {
    select: {
      id: true,
      serviceId: true,
      description: true,
      quantity: true,
      unitPrice: true,
      total: true,
    },
  },
};

const paymentMethodConfigSelect = {
  id: true,
  code: true,
  name: true,
  isActive: true,
};

const paymentDetailSelect = {
  id: true,
  attendanceId: true,
  amount: true,
  discount: true,
  total: true,
  paymentMethod: true,
  paymentMethodId: true,
  status: true,
  paidAt: true,
  createdAt: true,
  updatedAt: true,
  attendance: {
    select: paymentAttendanceSelect,
  },
  paymentMethodConfig: {
    select: paymentMethodConfigSelect,
  },
};

const paymentListSelect = {
  id: true,
  attendanceId: true,
  amount: true,
  discount: true,
  total: true,
  paymentMethod: true,
  paymentMethodId: true,
  status: true,
  paidAt: true,
  createdAt: true,
  attendance: {
    select: paymentAttendanceSelect,
  },
  paymentMethodConfig: {
    select: paymentMethodConfigSelect,
  },
};

function buildDateRange(filters) {
  const range = {};

  if (filters.startDate) {
    range.gte = new Date(`${filters.startDate}T00:00:00.000Z`);
  }

  if (filters.endDate) {
    range.lte = new Date(`${filters.endDate}T23:59:59.999Z`);
  }

  return Object.keys(range).length > 0 ? range : null;
}

function buildSearchWhere(search) {
  if (!search) {
    return [];
  }

  const normalized = search.trim();

  if (!normalized) {
    return [];
  }

  const searchUpper = normalized.toUpperCase();
  const searchClauses = [
    {
      attendance: {
        client: {
          name: { contains: normalized, mode: "insensitive" },
        },
      },
    },
    {
      attendance: {
        client: {
          phone: { contains: normalized },
        },
      },
    },
    {
      attendance: {
        client: {
          email: { contains: normalized, mode: "insensitive" },
        },
      },
    },
    {
      attendance: {
        professional: {
          name: { contains: normalized, mode: "insensitive" },
        },
      },
    },
    {
      attendance: {
        appointment: {
          service: {
            name: { contains: normalized, mode: "insensitive" },
          },
        },
      },
    },
    {
      attendance: {
        items: {
          some: {
            description: { contains: normalized, mode: "insensitive" },
          },
        },
      },
    },
    {
      paymentMethodConfig: {
        name: { contains: normalized, mode: "insensitive" },
      },
    },
    {
      paymentMethodConfig: {
        code: { contains: searchUpper, mode: "insensitive" },
      },
    },
  ];

  if (Object.values(PAYMENT_STATUS).includes(searchUpper)) {
    searchClauses.push({ status: searchUpper });
  }

  if (Object.values(PAYMENT_METHODS).includes(searchUpper)) {
    searchClauses.push({ paymentMethod: searchUpper });
  }

  return searchClauses;
}

function buildOperationalDateWhere(filters) {
  const range = buildDateRange(filters);

  if (!range) {
    return null;
  }

  return {
    OR: [
      { status: "PAID", paidAt: range },
      { status: "PAID", paidAt: null, createdAt: range },
      { status: { in: ["PENDING", "CANCELED"] }, createdAt: range },
    ],
  };
}

function buildWhere(filters) {
  const where = {};
  const andConditions = [];

  if (filters.status) where.status = filters.status;
  if (filters.paymentMethod) where.paymentMethod = filters.paymentMethod;
  if (filters.paymentMethodId) where.paymentMethodId = filters.paymentMethodId;
  if (filters.attendanceId) where.attendanceId = filters.attendanceId;

  if (filters.professionalId) {
    where.attendance = { professionalId: filters.professionalId };
  }

  const searchWhere = buildSearchWhere(filters.search);

  if (searchWhere.length > 0) {
    andConditions.push({ OR: searchWhere });
  }

  const dateWhere = buildOperationalDateWhere(filters);

  if (dateWhere) {
    andConditions.push(dateWhere);
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  return where;
}

function buildSummaryWhere(filters) {
  const where = {};

  const dateWhere = buildOperationalDateWhere(filters);

  if (dateWhere) {
    Object.assign(where, dateWhere);
  }

  return where;
}

export function findById(id) {
  if (!id) return null;
  return prisma.payment.findFirst({ where: { id }, select: paymentDetailSelect });
}

export function findByAttendanceId(attendanceId) {
  if (!attendanceId) return null;
  return prisma.payment.findFirst({ where: { attendanceId }, select: { id: true } });
}

export function findAttendanceForPayment(attendanceId) {
  if (!attendanceId) return null;
  return prisma.attendance.findFirst({
    where: { id: attendanceId },
    select: {
      id: true,
      status: true,
      professionalId: true,
      appointment: {
        select: {
          service: {
            select: {
              price: true,
            },
          },
        },
      },
      items: {
        select: {
          total: true,
        },
      },
      productItems: {
        select: {
          totalPriceCents: true,
        },
      },
    },
  });
}

export function findProfessionalByUserId(userId) {
  if (!userId) return null;
  return prisma.professional.findFirst({
    where: { userId, deletedAt: null },
    select: { id: true, userId: true },
  });
}

export function create(data) {
  return prisma.payment.create({ data, select: paymentDetailSelect });
}

export function list(filters) {
  return prisma.payment.findMany({
    where: buildWhere(filters),
    orderBy: { createdAt: "desc" },
    skip: (filters.page - 1) * filters.limit,
    take: filters.limit,
    select: paymentListSelect,
  });
}

export function count(filters) {
  return prisma.payment.count({ where: buildWhere(filters) });
}

export function update(id, data) {
  return prisma.payment.update({ where: { id }, data, select: paymentDetailSelect });
}

export function pay(id, paymentMethod, paymentMethodId) {
  const data = { status: "PAID", paidAt: new Date(), paymentMethod };
  if (paymentMethodId) data.paymentMethodId = paymentMethodId;

  return prisma.$transaction(async (tx) => {
    return tx.payment.update({
      where: { id },
      data,
      select: paymentDetailSelect,
    });
  });
}

export function cancel(id) {
  return prisma.payment.update({
    where: { id },
    data: { status: "CANCELED" },
    select: paymentDetailSelect,
  });
}

export async function getFinancialSummary(filters) {
  const where = buildSummaryWhere(filters);

  const [pending, paid, canceled] = await Promise.all([
    prisma.payment.aggregate({
      where: { ...where, status: "PENDING" },
      _sum: { total: true },
      _count: { id: true },
    }),
    prisma.payment.aggregate({
      where: { ...where, status: "PAID" },
      _sum: { total: true },
      _count: { id: true },
    }),
    prisma.payment.aggregate({
      where: { ...where, status: "CANCELED" },
      _sum: { total: true },
      _count: { id: true },
    }),
  ]);

  return {
    totalPending: parseFloat(Number(pending._sum.total ?? 0).toFixed(2)),
    totalPaid: parseFloat(Number(paid._sum.total ?? 0).toFixed(2)),
    totalCanceled: parseFloat(Number(canceled._sum.total ?? 0).toFixed(2)),
    countPending: pending._count.id,
    countPaid: paid._count.id,
    countCanceled: canceled._count.id,
  };
}
