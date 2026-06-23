import assert from "node:assert/strict";
import test from "node:test";

import prisma from "../../database/prisma.js";
import {
  findAppointmentForReschedule,
  findProfessionalAvailabilityContext,
  findConflictingAppointment,
  findActiveClientServiceAppointment,
  getSystemSettings,
  listByDay,
  listByWeek,
  listMonthSummaryRows,
  updateAppointmentSchedule,
} from "./appointment.repository.js";

test("listByDay usa janela UTC derivada do dia local America/Sao_Paulo", async (t) => {
  const originalFindMany = prisma.appointment.findMany;
  const calls = [];

  t.after(() => {
    prisma.appointment.findMany = originalFindMany;
  });

  prisma.appointment.findMany = async (args) => {
    calls.push(args);
    return [];
  };

  await listByDay({ date: "2026-06-23" });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].where.startAt.gte.toISOString(), "2026-06-23T03:00:00.000Z");
  assert.equal(calls[0].where.startAt.lte.toISOString(), "2026-06-24T02:59:59.999Z");
});

test("listByWeek usa janelas UTC corretas para início e fim do período local", async (t) => {
  const originalFindMany = prisma.appointment.findMany;
  const calls = [];

  t.after(() => {
    prisma.appointment.findMany = originalFindMany;
  });

  prisma.appointment.findMany = async (args) => {
    calls.push(args);
    return [];
  };

  await listByWeek({
    startDate: "2026-06-23",
    endDate: "2026-06-24",
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].where.startAt.gte.toISOString(), "2026-06-23T03:00:00.000Z");
  assert.equal(calls[0].where.startAt.lte.toISOString(), "2026-06-25T02:59:59.999Z");
});

test("findAppointmentForReschedule usa select explícito mínimo para reagendamento", async (t) => {
  const originalFindFirst = prisma.appointment.findFirst;
  const calls = [];

  t.after(() => {
    prisma.appointment.findFirst = originalFindFirst;
  });

  prisma.appointment.findFirst = async (args) => {
    calls.push(args);
    return null;
  };

  await findAppointmentForReschedule("apt-1");

  assert.equal(calls.length, 1);
  assert.deepEqual(Object.keys(calls[0].select).sort(), [
    "clientId",
    "endAt",
    "id",
    "professionalId",
    "service",
    "serviceId",
    "startAt",
    "status",
  ]);
  assert.deepEqual(Object.keys(calls[0].select.service.select).sort(), ["durationMinutes", "id"]);
});

test("findProfessionalAvailabilityContext traz apenas agenda e recorrências do dia solicitado", async (t) => {
  const originalFindFirst = prisma.professional.findFirst;
  const calls = [];

  t.after(() => {
    prisma.professional.findFirst = originalFindFirst;
  });

  prisma.professional.findFirst = async (args) => {
    calls.push(args);
    return null;
  };

  await findProfessionalAvailabilityContext("pro-1", 2);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].where.id, "pro-1");
  assert.equal(calls[0].select.schedules.where.weekday, 2);
  assert.equal(calls[0].select.recurringBlocks.where.dayOfWeek, 2);
  assert.deepEqual(Object.keys(calls[0].select).sort(), [
    "appointmentIntervalMinutes",
    "id",
    "recurringBlocks",
    "schedules",
    "status",
  ]);
});

test("findConflictingAppointment usa professionalId + janela de tempo + status bloqueantes", async (t) => {
  const originalFindFirst = prisma.appointment.findFirst;
  const calls = [];

  t.after(() => {
    prisma.appointment.findFirst = originalFindFirst;
  });

  prisma.appointment.findFirst = async (args) => {
    calls.push(args);
    return null;
  };

  await findConflictingAppointment(
    "pro-1",
    new Date("2026-06-23T12:00:00.000Z"),
    new Date("2026-06-23T13:00:00.000Z"),
    "apt-1",
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].where.professionalId, "pro-1");
  assert.equal(calls[0].where.id.not, "apt-1");
  assert.equal(calls[0].where.startAt.lt.toISOString(), "2026-06-23T13:00:00.000Z");
  assert.equal(calls[0].where.endAt.gt.toISOString(), "2026-06-23T12:00:00.000Z");
  assert.deepEqual(calls[0].where.status.in, ["SCHEDULED", "CONFIRMED", "IN_ATTENDANCE"]);
  assert.deepEqual(Object.keys(calls[0].select).sort(), ["endAt", "id", "startAt", "status"]);
});

test("findActiveClientServiceAppointment filtra cliente, serviço e status ativos com select mínimo", async (t) => {
  const originalFindFirst = prisma.appointment.findFirst;
  const calls = [];
  t.after(() => { prisma.appointment.findFirst = originalFindFirst; });
  prisma.appointment.findFirst = async (args) => { calls.push(args); return null; };

  await findActiveClientServiceAppointment("client-1", "service-1");

  assert.equal(calls.length, 1);
  assert.equal(calls[0].where.clientId, "client-1");
  assert.equal(calls[0].where.serviceId, "service-1");
  assert.deepEqual(calls[0].where.status.in, ["SCHEDULED", "CONFIRMED", "IN_ATTENDANCE"]);
  assert.equal(calls[0].where.deletedAt, null);
  assert.equal(calls[0].where.OR[0].startAt.gte instanceof Date, true);
  assert.deepEqual(calls[0].where.OR[1], { status: "IN_ATTENDANCE" });
  assert.equal(calls[0].orderBy.startAt, "asc");
  assert.deepEqual(Object.keys(calls[0].select).sort(), ["client", "clientId", "endAt", "id", "professional", "professionalId", "service", "serviceId", "startAt", "status"]);
  assert.deepEqual(Object.keys(calls[0].select.client.select).sort(), ["id", "name"]);
  assert.deepEqual(Object.keys(calls[0].select.professional.select).sort(), ["id", "name"]);
  assert.deepEqual(Object.keys(calls[0].select.service.select).sort(), ["id", "name"]);
});

test("métodos novos aceitam tx explícito sem tocar no prisma global", async () => {
  const calls = [];
  const tx = {
    appointment: {
      findFirst: async (args) => {
        calls.push(["appointment.findFirst", args]);
        return null;
      },
      update: async (args) => {
        calls.push(["appointment.update", args]);
        return null;
      },
    },
    professional: {
      findFirst: async (args) => {
        calls.push(["professional.findFirst", args]);
        return null;
      },
    },
    systemSetting: {
      findMany: async (args) => {
        calls.push(["systemSetting.findMany", args]);
        return [];
      },
    },
  };

  await findAppointmentForReschedule("apt-1", tx);
  await findProfessionalAvailabilityContext("pro-1", 2, tx);
  await getSystemSettings(["default_open_time"], tx);
  await updateAppointmentSchedule(
    "apt-1",
    {
      professionalId: "pro-2",
      startAt: new Date("2026-06-23T12:00:00.000Z"),
      endAt: new Date("2026-06-23T13:00:00.000Z"),
    },
    tx,
  );

  assert.deepEqual(
    calls.map(([name]) => name),
    [
      "appointment.findFirst",
      "professional.findFirst",
      "systemSetting.findMany",
      "appointment.update",
    ],
  );
});

test("listMonthSummaryRows aplica filtro de busca quando search está presente", async (t) => {
  const originalFindMany = prisma.appointment.findMany;
  const calls = [];

  t.after(() => {
    prisma.appointment.findMany = originalFindMany;
  });

  prisma.appointment.findMany = async (args) => {
    calls.push(args);
    return [];
  };

  await listMonthSummaryRows({ startDate: "2026-06-01", endDate: "2026-06-30", search: "João" });

  assert.equal(calls.length, 1);
  assert.ok(calls[0].where.OR, "deve incluir cláusula OR para busca de texto");
  assert.ok(
    calls[0].where.OR.some((cond) => cond.client?.name?.contains === "João"),
    "deve filtrar por nome do cliente",
  );
});

test("listMonthSummaryRows não aplica filtro de busca quando search está ausente", async (t) => {
  const originalFindMany = prisma.appointment.findMany;
  const calls = [];

  t.after(() => {
    prisma.appointment.findMany = originalFindMany;
  });

  prisma.appointment.findMany = async (args) => {
    calls.push(args);
    return [];
  };

  await listMonthSummaryRows({ startDate: "2026-06-01", endDate: "2026-06-30" });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].where.OR, undefined, "não deve incluir cláusula OR sem search");
});

test("listMonthSummaryRows não aplica filtro de status quando status está ausente", async (t) => {
  const originalFindMany = prisma.appointment.findMany;
  const calls = [];

  t.after(() => {
    prisma.appointment.findMany = originalFindMany;
  });

  prisma.appointment.findMany = async (args) => {
    calls.push(args);
    return [];
  };

  await listMonthSummaryRows({ startDate: "2026-06-01", endDate: "2026-06-30" });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].where.status, undefined, "status ausente não deve restringir resultados");
});

test("listMonthSummaryRows filtra por status quando informado", async (t) => {
  const originalFindMany = prisma.appointment.findMany;
  const calls = [];

  t.after(() => {
    prisma.appointment.findMany = originalFindMany;
  });

  prisma.appointment.findMany = async (args) => {
    calls.push(args);
    return [];
  };

  await listMonthSummaryRows({ startDate: "2026-06-01", endDate: "2026-06-30", status: "SCHEDULED" });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].where.status, "SCHEDULED");
});
