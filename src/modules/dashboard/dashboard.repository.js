import { Prisma } from "@prisma/client";

import prisma from "../../database/prisma.js";

export async function getTodayStats({ startOfDay, endOfDay }) {
  const [appointments, attendancesInProgress, completedAttendances, revenueResult] =
    await Promise.all([
      prisma.appointment.count({
        where: {
          deletedAt: null,
          startAt: {
            gte: startOfDay,
            lt: endOfDay,
          },
        },
      }),
      prisma.attendance.count({
        where: {
          status: "OPEN",
        },
      }),
      prisma.attendance.count({
        where: {
          status: "FINISHED",
          finishedAt: {
            gte: startOfDay,
            lt: endOfDay,
          },
        },
      }),
      prisma.payment.aggregate({
        _sum: {
          total: true,
        },
        where: {
          status: "PAID",
          paidAt: {
            gte: startOfDay,
            lt: endOfDay,
          },
        },
      }),
    ]);

  return {
    appointments,
    attendancesInProgress,
    completedAttendances,
    revenue: Number(revenueResult._sum.total ?? 0),
  };
}

export async function getMonthStats({ startOfMonth, endOfMonth }) {
  const [revenueResult, appointments, newClients] = await Promise.all([
    prisma.payment.aggregate({
      _sum: {
        total: true,
      },
      where: {
        status: "PAID",
        paidAt: {
          gte: startOfMonth,
          lt: endOfMonth,
        },
      },
    }),
    prisma.appointment.count({
      where: {
        deletedAt: null,
        startAt: {
          gte: startOfMonth,
          lt: endOfMonth,
        },
      },
    }),
    prisma.client.count({
      where: {
        deletedAt: null,
        createdAt: {
          gte: startOfMonth,
          lt: endOfMonth,
        },
      },
    }),
  ]);

  return {
    revenue: Number(revenueResult._sum.total ?? 0),
    appointments,
    newClients,
  };
}

export function getNextAppointment(now) {
  return prisma.appointment.findFirst({
    where: {
      deletedAt: null,
      status: {
        in: ["SCHEDULED", "CONFIRMED"],
      },
      startAt: {
        gt: now,
      },
    },
    orderBy: {
      startAt: "asc",
    },
    select: {
      id: true,
      startAt: true,
      client: {
        select: {
          id: true,
          name: true,
        },
      },
      professional: {
        select: {
          id: true,
          name: true,
        },
      },
      service: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

export function getBirthdays(month) {
  return prisma.$queryRaw(
    Prisma.sql`
      SELECT
        c."id",
        c."name",
        c."birthDate"
      FROM "clients" c
      WHERE
        c."deletedAt" IS NULL
        AND c."status" = 'ACTIVE'::"UserStatus"
        AND c."birthDate" IS NOT NULL
        AND EXTRACT(MONTH FROM c."birthDate") = ${month}
      ORDER BY EXTRACT(DAY FROM c."birthDate") ASC, c."name" ASC
      LIMIT 20
    `,
  );
}

export function getTopClients() {
  return prisma.$queryRaw(
    Prisma.sql`
      SELECT
        c."id" AS "clientId",
        c."name",
        COUNT(a."id")::int AS "attendances"
      FROM "clients" c
      INNER JOIN "attendances" a
        ON a."clientId" = c."id"
      WHERE
        c."deletedAt" IS NULL
        AND a."status" = 'FINISHED'::"AttendanceStatus"
      GROUP BY c."id", c."name"
      ORDER BY "attendances" DESC, c."name" ASC
      LIMIT 10
    `,
  );
}

export async function getStatusDistribution() {
  const rows = await prisma.appointment.groupBy({
    by: ["status"],
    where: {
      deletedAt: null,
    },
    _count: {
      status: true,
    },
  });

  return rows.reduce((accumulator, row) => {
    accumulator[row.status] = row._count.status;
    return accumulator;
  }, {});
}

export async function getExecutiveStats({
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
}) {
  const [
    todayPayments,
    monthPayments,
    totalAppointmentsToday,
    totalAppointmentsMonth,
    totalAttendancesToday,
    totalAttendancesMonth,
    canceledAppointmentsMonth,
    noShowAppointmentsMonth,
  ] = await Promise.all([
    prisma.payment.aggregate({
      _sum: {
        total: true,
      },
      _count: {
        id: true,
      },
      where: {
        status: "PAID",
        paidAt: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
    }),
    prisma.payment.aggregate({
      _sum: {
        total: true,
      },
      _count: {
        id: true,
      },
      where: {
        status: "PAID",
        paidAt: {
          gte: startOfMonth,
          lt: endOfMonth,
        },
      },
    }),
    prisma.appointment.count({
      where: {
        deletedAt: null,
        startAt: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
    }),
    prisma.appointment.count({
      where: {
        deletedAt: null,
        startAt: {
          gte: startOfMonth,
          lt: endOfMonth,
        },
      },
    }),
    prisma.attendance.count({
      where: {
        startedAt: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
    }),
    prisma.attendance.count({
      where: {
        startedAt: {
          gte: startOfMonth,
          lt: endOfMonth,
        },
      },
    }),
    prisma.appointment.count({
      where: {
        deletedAt: null,
        status: "CANCELED",
        startAt: {
          gte: startOfMonth,
          lt: endOfMonth,
        },
      },
    }),
    prisma.appointment.count({
      where: {
        deletedAt: null,
        status: "NO_SHOW",
        startAt: {
          gte: startOfMonth,
          lt: endOfMonth,
        },
      },
    }),
  ]);

  return {
    averageTicketToday: {
      total: Number(todayPayments._sum.total ?? 0),
      count: todayPayments._count.id,
    },
    averageTicketMonth: {
      total: Number(monthPayments._sum.total ?? 0),
      count: monthPayments._count.id,
    },
    totalAppointmentsToday,
    totalAppointmentsMonth,
    totalAttendancesToday,
    totalAttendancesMonth,
    canceledAppointmentsMonth,
    noShowAppointmentsMonth,
  };
}

export function getTopServices() {
  return prisma.$queryRaw(
    Prisma.sql`
      SELECT
        s."id" AS "serviceId",
        s."name",
        COALESCE(SUM(ai."quantity"), 0)::int AS "quantity",
        COALESCE(SUM(ai."total"), 0)::double precision AS "total"
      FROM "attendance_items" ai
      INNER JOIN "attendances" a
        ON a."id" = ai."attendanceId"
      INNER JOIN "services" s
        ON s."id" = ai."serviceId"
      WHERE
        a."status" = 'FINISHED'::"AttendanceStatus"
        AND s."deletedAt" IS NULL
      GROUP BY s."id", s."name"
      ORDER BY "quantity" DESC, "total" DESC, s."name" ASC
      LIMIT 10
    `,
  );
}

export function getTopProfessionals() {
  return prisma.$queryRaw(
    Prisma.sql`
      SELECT
        pr."id" AS "professionalId",
        pr."name",
        COALESCE(SUM(p."total"), 0)::double precision AS "revenue",
        COUNT(a."id")::int AS "attendances"
      FROM "payments" p
      INNER JOIN "attendances" a
        ON a."id" = p."attendanceId"
      INNER JOIN "professionals" pr
        ON pr."id" = a."professionalId"
      WHERE
        p."status" = 'PAID'::"PaymentStatus"
        AND pr."deletedAt" IS NULL
      GROUP BY pr."id", pr."name"
      ORDER BY "revenue" DESC, "attendances" DESC, pr."name" ASC
      LIMIT 10
    `,
  );
}

export function getBusyHours({ startOfMonth, endOfMonth }) {
  return prisma.$queryRaw(
    Prisma.sql`
      SELECT
        LPAD(EXTRACT(HOUR FROM a."startAt")::text, 2, '0') || ':00' AS "hour",
        COUNT(a."id")::int AS "appointments"
      FROM "appointments" a
      WHERE
        a."deletedAt" IS NULL
        AND a."startAt" >= ${startOfMonth}
        AND a."startAt" < ${endOfMonth}
      GROUP BY EXTRACT(HOUR FROM a."startAt")
      ORDER BY "appointments" DESC, "hour" ASC
    `,
  );
}

export function getUpcomingAppointments(now) {
  return prisma.appointment.findMany({
    where: {
      deletedAt: null,
      status: {
        in: ["SCHEDULED", "CONFIRMED"],
      },
      startAt: {
        gt: now,
      },
    },
    orderBy: {
      startAt: "asc",
    },
    take: 10,
    select: {
      id: true,
      startAt: true,
      endAt: true,
      status: true,
      client: {
        select: {
          id: true,
          name: true,
        },
      },
      professional: {
        select: {
          id: true,
          name: true,
        },
      },
      service: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

export async function getMonthComparison({
  startOfCurrentMonth,
  endOfCurrentMonth,
  startOfPreviousMonth,
  endOfPreviousMonth,
}) {
  const [currentMonth, previousMonth] = await Promise.all([
    prisma.payment.aggregate({
      _sum: {
        total: true,
      },
      where: {
        status: "PAID",
        paidAt: {
          gte: startOfCurrentMonth,
          lt: endOfCurrentMonth,
        },
      },
    }),
    prisma.payment.aggregate({
      _sum: {
        total: true,
      },
      where: {
        status: "PAID",
        paidAt: {
          gte: startOfPreviousMonth,
          lt: endOfPreviousMonth,
        },
      },
    }),
  ]);

  return {
    currentMonthRevenue: Number(currentMonth._sum.total ?? 0),
    previousMonthRevenue: Number(previousMonth._sum.total ?? 0),
  };
}
