import { Prisma } from "@prisma/client";

import prisma from "../../database/prisma.js";

const safeClientSelect = {
  id: true,
  userId: true,
  name: true,
  phone: true,
  email: true,
  birthDate: true,
  notes: true,
  status: true,
  createdAt: true,
  updatedAt: true,
};

function buildClientWhere(filters) {
  const where = {
    deletedAt: null,
  };

  if (filters.search) {
    where.OR = [
      {
        name: {
          contains: filters.search,
          mode: "insensitive",
        },
      },
      {
        phone: {
          contains: filters.search,
          mode: "insensitive",
        },
      },
      {
        email: {
          contains: filters.search,
          mode: "insensitive",
        },
      },
    ];
  }

  if (filters.status) {
    where.status = filters.status;
  }

  return where;
}

function buildBirthMonthConditions(filters) {
  const conditions = [Prisma.sql`c."deletedAt" IS NULL`];

  if (filters.search) {
    const searchTerm = `%${filters.search}%`;

    conditions.push(
      Prisma.sql`(
        c."name" ILIKE ${searchTerm}
        OR c."phone" ILIKE ${searchTerm}
        OR c."email" ILIKE ${searchTerm}
      )`,
    );
  }

  if (filters.status) {
    conditions.push(
      filters.status === "ACTIVE"
        ? Prisma.sql`c."status" = 'ACTIVE'::"UserStatus"`
        : Prisma.sql`c."status" = 'INACTIVE'::"UserStatus"`,
    );
  }

  conditions.push(
    Prisma.sql`EXTRACT(MONTH FROM c."birthDate") = ${filters.birthMonth}`,
  );

  return conditions;
}

export function create(data) {
  return prisma.client.create({
    data,
    select: safeClientSelect,
  });
}

export function findById(id) {
  if (!id) {
    return null;
  }

  return prisma.client.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    select: safeClientSelect,
  });
}

export function findByUserId(userId) {
  if (!userId) {
    return null;
  }

  return prisma.client.findFirst({
    where: {
      userId,
      deletedAt: null,
    },
    select: safeClientSelect,
  });
}

export function findByPhone(phone) {
  if (!phone) {
    return null;
  }

  return prisma.client.findFirst({
    where: {
      phone,
      deletedAt: null,
    },
    select: safeClientSelect,
  });
}

export function findByEmail(email) {
  if (!email) {
    return null;
  }

  return prisma.client.findFirst({
    where: {
      email,
      deletedAt: null,
    },
    select: safeClientSelect,
  });
}

export function findByPhoneIgnoringId(phone, id) {
  if (!phone) {
    return null;
  }

  return prisma.client.findFirst({
    where: {
      phone,
      deletedAt: null,
      id: {
        not: id,
      },
    },
    select: safeClientSelect,
  });
}

export function findByEmailIgnoringId(email, id) {
  if (!email) {
    return null;
  }

  return prisma.client.findFirst({
    where: {
      email,
      deletedAt: null,
      id: {
        not: id,
      },
    },
    select: safeClientSelect,
  });
}

export function list(filters) {
  if (!filters.birthMonth) {
    return prisma.client.findMany({
      where: buildClientWhere(filters),
      orderBy: {
        createdAt: "desc",
      },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
      select: safeClientSelect,
    });
  }

  const conditions = buildBirthMonthConditions(filters);

  return prisma.$queryRaw(
    Prisma.sql`
      SELECT
        c."id",
        c."userId",
        c."name",
        c."phone",
        c."email",
        c."birthDate",
        c."notes",
        c."status",
        c."createdAt",
        c."updatedAt"
      FROM "clients" c
      WHERE ${Prisma.join(conditions, Prisma.sql` AND `)}
      ORDER BY c."createdAt" DESC
      LIMIT ${filters.limit}
      OFFSET ${(filters.page - 1) * filters.limit}
    `,
  );
}

export async function count(filters) {
  if (!filters.birthMonth) {
    return prisma.client.count({
      where: buildClientWhere(filters),
    });
  }

  const conditions = buildBirthMonthConditions(filters);
  const [result] = await prisma.$queryRaw(
    Prisma.sql`
      SELECT COUNT(*)::int AS "total"
      FROM "clients" c
      WHERE ${Prisma.join(conditions, Prisma.sql` AND `)}
    `,
  );

  return result?.total ?? 0;
}

export function update(id, data) {
  return prisma.client.update({
    where: { id },
    data,
    select: safeClientSelect,
  });
}

export function softDelete(id, deletedPhone, deletedEmail) {
  return prisma.client.update({
    where: { id },
    data: {
      phone: deletedPhone,
      email: deletedEmail,
      deletedAt: new Date(),
    },
    select: safeClientSelect,
  });
}

export function listBirthdaysByMonth(month) {
  return prisma.$queryRaw(
    Prisma.sql`
      SELECT
        c."id",
        c."userId",
        c."name",
        c."phone",
        c."email",
        c."birthDate",
        c."notes",
        c."status",
        c."createdAt",
        c."updatedAt"
      FROM "clients" c
      WHERE
        c."deletedAt" IS NULL
        AND c."status" = 'ACTIVE'::"UserStatus"
        AND c."birthDate" IS NOT NULL
        AND EXTRACT(MONTH FROM c."birthDate") = ${month}
      ORDER BY EXTRACT(DAY FROM c."birthDate") ASC, c."name" ASC
    `,
  );
}

export function listTopActiveClients(limit) {
  return prisma.$queryRaw(
    Prisma.sql`
      SELECT
        c."id",
        c."userId",
        c."name",
        c."phone",
        c."email",
        c."birthDate",
        c."notes",
        c."status",
        c."createdAt",
        c."updatedAt",
        COUNT(a."id")::int AS "finishedAttendances"
      FROM "clients" c
      INNER JOIN "attendances" a
        ON a."clientId" = c."id"
      WHERE
        c."deletedAt" IS NULL
        AND c."status" = 'ACTIVE'::"UserStatus"
        AND a."status" = 'FINISHED'::"AttendanceStatus"
      GROUP BY
        c."id",
        c."userId",
        c."name",
        c."phone",
        c."email",
        c."birthDate",
        c."notes",
        c."status",
        c."createdAt",
        c."updatedAt"
      ORDER BY "finishedAttendances" DESC, c."name" ASC
      LIMIT ${limit}
    `,
  );
}
