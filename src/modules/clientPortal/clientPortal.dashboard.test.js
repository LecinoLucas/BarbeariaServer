import assert from "node:assert/strict";
import test from "node:test";

import { ROLES } from "../../constants/roles.js";
import { NotFoundError } from "../../errors/NotFoundError.js";
import { authorizeRoles } from "../../middlewares/role.middleware.js";
import prisma from "../../database/prisma.js";
import { getClientDashboard } from "./clientPortal.service.js";
import { ensureClientPortalEnabled } from "./clientPortalAccess.middleware.js";
import clientPortalRoutes from "./clientPortal.routes.js";

// UTC equivalente de 2026-06-23 09:00 America/Sao_Paulo (BRT = UTC-3 → 12:00 UTC)
const ATTENDANCE_STARTED_AT = new Date("2026-06-23T12:00:00.000Z");

function makeAttendance(overrides = {}) {
  return {
    id: "att-1",
    appointmentId: "appt-1",
    clientId: "client-1",
    professionalId: "prof-1",
    startedAt: ATTENDANCE_STARTED_AT,
    finishedAt: ATTENDANCE_STARTED_AT,
    status: "FINISHED",
    notes: null,
    createdAt: ATTENDANCE_STARTED_AT,
    updatedAt: ATTENDANCE_STARTED_AT,
    professional: { id: "prof-1", name: "João", specialty: null },
    appointment: {
      id: "appt-1",
      startAt: ATTENDANCE_STARTED_AT,
      endAt: ATTENDANCE_STARTED_AT,
      status: "FINISHED",
      service: { id: "svc-1", name: "Corte Degradê", price: 50, durationMinutes: 40 },
    },
    items: [
      {
        id: "item-1",
        serviceId: "svc-1",
        description: null,
        quantity: 1,
        unitPrice: 50,
        total: 50,
        service: { id: "svc-1", name: "Corte Degradê" },
      },
    ],
    ...overrides,
  };
}

function makeAppointment(overrides = {}) {
  const startAt = new Date("2026-07-01T12:00:00.000Z");
  return {
    id: "appt-future",
    clientId: "client-1",
    professionalId: "prof-1",
    serviceId: "svc-1",
    startAt,
    endAt: new Date("2026-07-01T12:40:00.000Z"),
    status: "SCHEDULED",
    notes: null,
    createdAt: startAt,
    updatedAt: startAt,
    professional: { id: "prof-1", name: "João", specialty: null },
    service: { id: "svc-1", name: "Corte Degradê", price: 50, durationMinutes: 40 },
    client: { id: "client-1", name: "Cliente Teste" },
    ...overrides,
  };
}

test("getClientDashboard lança NotFoundError quando userId não tem perfil de cliente", async (t) => {
  const original = prisma.client.findFirst;
  const origSettings = prisma.systemSetting.findMany;
  t.after(() => { prisma.client.findFirst = original; });
  t.after(() => { prisma.systemSetting.findMany = origSettings; });
  prisma.client.findFirst = async () => null;
  prisma.systemSetting.findMany = async () => [];

  await assert.rejects(
    () => getClientDashboard("user-sem-cliente"),
    NotFoundError,
  );
});

test("getClientDashboard retorna estado vazio com zeros e nulls quando não há dados", async (t) => {
  const origClient = prisma.client.findFirst;
  const origApptFirst = prisma.appointment.findFirst;
  const origAttFirst = prisma.attendance.findFirst;
  const origAttCount = prisma.attendance.count;
  const origApptCount = prisma.appointment.count;
  const origAttFindMany = prisma.attendance.findMany;
  const origSettings = prisma.systemSetting.findMany;

  t.after(() => {
    prisma.client.findFirst = origClient;
    prisma.appointment.findFirst = origApptFirst;
    prisma.attendance.findFirst = origAttFirst;
    prisma.attendance.count = origAttCount;
    prisma.appointment.count = origApptCount;
    prisma.attendance.findMany = origAttFindMany;
    prisma.systemSetting.findMany = origSettings;
  });

  prisma.client.findFirst = async () => ({ id: "client-1", userId: "user-1" });
  prisma.appointment.findFirst = async () => null;
  prisma.attendance.findFirst = async () => null;
  prisma.attendance.count = async () => 0;
  prisma.appointment.count = async () => 0;
  prisma.attendance.findMany = async () => [];
  prisma.systemSetting.findMany = async () => [];

  const result = await getClientDashboard("user-1");

  assert.deepEqual(result.summary, {
    totalAppointments: 0,
    completedAppointments: 0,
    appointmentsThisMonth: 0,
  });
  assert.equal(result.lastVisit, null);
  assert.equal(result.nextAppointment, null);
  assert.deepEqual(result.recentHistory, []);
});

test("getClientDashboard formata lastVisit com data/hora no fuso America/Sao_Paulo", async (t) => {
  const origClient = prisma.client.findFirst;
  const origApptFirst = prisma.appointment.findFirst;
  const origAttFirst = prisma.attendance.findFirst;
  const origAttCount = prisma.attendance.count;
  const origApptCount = prisma.appointment.count;
  const origAttFindMany = prisma.attendance.findMany;
  const origSettings = prisma.systemSetting.findMany;

  t.after(() => {
    prisma.client.findFirst = origClient;
    prisma.appointment.findFirst = origApptFirst;
    prisma.attendance.findFirst = origAttFirst;
    prisma.attendance.count = origAttCount;
    prisma.appointment.count = origApptCount;
    prisma.attendance.findMany = origAttFindMany;
    prisma.systemSetting.findMany = origSettings;
  });

  const attendance = makeAttendance();

  prisma.client.findFirst = async () => ({ id: "client-1", userId: "user-1" });
  prisma.appointment.findFirst = async () => null;
  prisma.attendance.findFirst = async () => attendance;
  prisma.attendance.count = async () => 0;
  prisma.appointment.count = async () => 0;
  prisma.attendance.findMany = async () => [];
  prisma.systemSetting.findMany = async () => [];

  const result = await getClientDashboard("user-1");

  // 2026-06-23T12:00:00.000Z = 09:00 em America/Sao_Paulo
  assert.equal(result.lastVisit.date, "2026-06-23");
  assert.equal(result.lastVisit.time, "09:00");
  assert.equal(result.lastVisit.professionalName, "João");
  assert.deepEqual(result.lastVisit.services, ["Corte Degradê"]);
  assert.equal(result.lastVisit.status, "FINISHED");
  assert.equal(result.lastVisit.id, "appt-1");
});

test("getClientDashboard formata nextAppointment com data/hora no fuso America/Sao_Paulo", async (t) => {
  const origClient = prisma.client.findFirst;
  const origApptFirst = prisma.appointment.findFirst;
  const origAttFirst = prisma.attendance.findFirst;
  const origAttCount = prisma.attendance.count;
  const origApptCount = prisma.appointment.count;
  const origAttFindMany = prisma.attendance.findMany;
  const origSettings = prisma.systemSetting.findMany;

  t.after(() => {
    prisma.client.findFirst = origClient;
    prisma.appointment.findFirst = origApptFirst;
    prisma.attendance.findFirst = origAttFirst;
    prisma.attendance.count = origAttCount;
    prisma.appointment.count = origApptCount;
    prisma.attendance.findMany = origAttFindMany;
    prisma.systemSetting.findMany = origSettings;
  });

  const appt = makeAppointment();
  // 2026-07-01T12:00:00.000Z = 09:00 BRT
  prisma.client.findFirst = async () => ({ id: "client-1", userId: "user-1" });
  prisma.appointment.findFirst = async () => appt;
  prisma.attendance.findFirst = async () => null;
  prisma.attendance.count = async () => 0;
  prisma.appointment.count = async () => 0;
  prisma.attendance.findMany = async () => [];
  prisma.systemSetting.findMany = async () => [];

  const result = await getClientDashboard("user-1");

  assert.equal(result.nextAppointment.date, "2026-07-01");
  assert.equal(result.nextAppointment.time, "09:00");
  assert.equal(result.nextAppointment.professionalName, "João");
  assert.deepEqual(result.nextAppointment.services, ["Corte Degradê"]);
  assert.equal(result.nextAppointment.status, "SCHEDULED");
});

test("getClientDashboard reflete appointmentsThisMonth no summary", async (t) => {
  const origClient = prisma.client.findFirst;
  const origApptFirst = prisma.appointment.findFirst;
  const origAttFirst = prisma.attendance.findFirst;
  const origAttCount = prisma.attendance.count;
  const origApptCount = prisma.appointment.count;
  const origAttFindMany = prisma.attendance.findMany;
  const origSettings = prisma.systemSetting.findMany;

  let countCallIndex = 0;

  t.after(() => {
    prisma.client.findFirst = origClient;
    prisma.appointment.findFirst = origApptFirst;
    prisma.attendance.findFirst = origAttFirst;
    prisma.attendance.count = origAttCount;
    prisma.appointment.count = origApptCount;
    prisma.attendance.findMany = origAttFindMany;
    prisma.systemSetting.findMany = origSettings;
  });

  prisma.client.findFirst = async () => ({ id: "client-1", userId: "user-1" });
  prisma.appointment.findFirst = async () => null;
  prisma.attendance.findFirst = async () => null;
  // countFinishedAttendancesByPeriod chamado com startOfMonth/endOfMonth retorna 3
  // countAllFinishedAttendances retorna 10
  prisma.attendance.count = async () => {
    countCallIndex += 1;
    return countCallIndex === 1 ? 3 : 10;
  };
  prisma.appointment.count = async () => 15;
  prisma.attendance.findMany = async () => [];
  prisma.systemSetting.findMany = async () => [];

  const result = await getClientDashboard("user-1");

  assert.equal(result.summary.appointmentsThisMonth, 3);
  assert.equal(result.summary.completedAppointments, 10);
  assert.equal(result.summary.totalAppointments, 15);
});

test("getClientDashboard ignora agendamentos ligados a serviço ou profissional deletado no próximo horário e no total", async (t) => {
  const origClient = prisma.client.findFirst;
  const origApptFirst = prisma.appointment.findFirst;
  const origAttFirst = prisma.attendance.findFirst;
  const origAttCount = prisma.attendance.count;
  const origApptCount = prisma.appointment.count;
  const origAttFindMany = prisma.attendance.findMany;
  const origSettings = prisma.systemSetting.findMany;
  let receivedNextWhere = null;
  let receivedCountWhere = null;

  t.after(() => {
    prisma.client.findFirst = origClient;
    prisma.appointment.findFirst = origApptFirst;
    prisma.attendance.findFirst = origAttFirst;
    prisma.attendance.count = origAttCount;
    prisma.appointment.count = origApptCount;
    prisma.attendance.findMany = origAttFindMany;
    prisma.systemSetting.findMany = origSettings;
  });

  prisma.client.findFirst = async () => ({ id: "client-1", userId: "user-1" });
  prisma.appointment.findFirst = async ({ where }) => {
    receivedNextWhere = where;
    return null;
  };
  prisma.attendance.findFirst = async () => null;
  prisma.attendance.count = async () => 0;
  prisma.appointment.count = async ({ where }) => {
    receivedCountWhere = where;
    return 0;
  };
  prisma.attendance.findMany = async () => [];
  prisma.systemSetting.findMany = async () => [];

  await getClientDashboard("user-1");

  assert.equal(receivedNextWhere.service.deletedAt, null);
  assert.equal(receivedNextWhere.professional.deletedAt, null);
  assert.equal(receivedCountWhere.service.deletedAt, null);
  assert.equal(receivedCountWhere.professional.deletedAt, null);
});

test("getClientDashboard retorna recentHistory com até 5 registros formatados", async (t) => {
  const origClient = prisma.client.findFirst;
  const origApptFirst = prisma.appointment.findFirst;
  const origAttFirst = prisma.attendance.findFirst;
  const origAttCount = prisma.attendance.count;
  const origApptCount = prisma.appointment.count;
  const origAttFindMany = prisma.attendance.findMany;
  const origSettings = prisma.systemSetting.findMany;

  t.after(() => {
    prisma.client.findFirst = origClient;
    prisma.appointment.findFirst = origApptFirst;
    prisma.attendance.findFirst = origAttFirst;
    prisma.attendance.count = origAttCount;
    prisma.appointment.count = origApptCount;
    prisma.attendance.findMany = origAttFindMany;
    prisma.systemSetting.findMany = origSettings;
  });

  const history = [
    makeAttendance({ id: "att-1", appointmentId: "appt-1" }),
    makeAttendance({ id: "att-2", appointmentId: "appt-2" }),
    makeAttendance({ id: "att-3", appointmentId: "appt-3" }),
    makeAttendance({ id: "att-4", appointmentId: "appt-4" }),
    makeAttendance({ id: "att-5", appointmentId: "appt-5" }),
    makeAttendance({ id: "att-6", appointmentId: "appt-6" }),
  ];

  prisma.client.findFirst = async () => ({ id: "client-1", userId: "user-1" });
  prisma.appointment.findFirst = async () => null;
  prisma.attendance.findFirst = async () => null;
  prisma.attendance.count = async () => 0;
  prisma.appointment.count = async () => 0;
  prisma.attendance.findMany = async () => history;
  prisma.systemSetting.findMany = async () => [];

  const result = await getClientDashboard("user-1");

  assert.equal(result.recentHistory.length, 5);
  assert.equal(result.recentHistory[0].id, "appt-1");
  assert.equal(result.recentHistory[0].date, "2026-06-23");
  assert.equal(result.recentHistory[0].time, "09:00");
  assert.deepEqual(result.recentHistory[0].services, ["Corte Degradê"]);
});

test("getClientDashboard respeita historyLimit e oculta blocos configurados", async (t) => {
  const origClient = prisma.client.findFirst;
  const origApptFirst = prisma.appointment.findFirst;
  const origAttFirst = prisma.attendance.findFirst;
  const origAttCount = prisma.attendance.count;
  const origApptCount = prisma.appointment.count;
  const origAttFindMany = prisma.attendance.findMany;
  const origSettings = prisma.systemSetting.findMany;

  t.after(() => {
    prisma.client.findFirst = origClient;
    prisma.appointment.findFirst = origApptFirst;
    prisma.attendance.findFirst = origAttFirst;
    prisma.attendance.count = origAttCount;
    prisma.appointment.count = origApptCount;
    prisma.attendance.findMany = origAttFindMany;
    prisma.systemSetting.findMany = origSettings;
  });

  const history = [
    makeAttendance({ id: "att-1", appointmentId: "appt-1" }),
    makeAttendance({ id: "att-2", appointmentId: "appt-2" }),
    makeAttendance({ id: "att-3", appointmentId: "appt-3" }),
  ];

  prisma.client.findFirst = async () => ({ id: "client-1", userId: "user-1" });
  prisma.appointment.findFirst = async () => makeAppointment();
  prisma.attendance.findFirst = async () => makeAttendance();
  prisma.attendance.count = async () => 0;
  prisma.appointment.count = async () => 0;
  prisma.attendance.findMany = async () => history;
  prisma.systemSetting.findMany = async () => [
    {
      id: "s1",
      key: "client_portal_dashboard_show_last_visit",
      value: "false",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "s2",
      key: "client_portal_dashboard_show_next_appointment",
      value: "false",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "s3",
      key: "client_portal_dashboard_history_limit",
      value: "2",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const result = await getClientDashboard("user-1");

  assert.equal(result.lastVisit, null);
  assert.equal(result.nextAppointment, null);
  assert.equal(result.recentHistory.length, 2);
});

test("getClientDashboard retorna histórico vazio quando showRecentHistory=false", async (t) => {
  const origClient = prisma.client.findFirst;
  const origApptFirst = prisma.appointment.findFirst;
  const origAttFirst = prisma.attendance.findFirst;
  const origAttCount = prisma.attendance.count;
  const origApptCount = prisma.appointment.count;
  const origAttFindMany = prisma.attendance.findMany;
  const origSettings = prisma.systemSetting.findMany;

  t.after(() => {
    prisma.client.findFirst = origClient;
    prisma.appointment.findFirst = origApptFirst;
    prisma.attendance.findFirst = origAttFirst;
    prisma.attendance.count = origAttCount;
    prisma.appointment.count = origApptCount;
    prisma.attendance.findMany = origAttFindMany;
    prisma.systemSetting.findMany = origSettings;
  });

  prisma.client.findFirst = async () => ({ id: "client-1", userId: "user-1" });
  prisma.appointment.findFirst = async () => null;
  prisma.attendance.findFirst = async () => makeAttendance();
  prisma.attendance.count = async () => 0;
  prisma.appointment.count = async () => 0;
  prisma.attendance.findMany = async () => {
    throw new Error("não deve carregar histórico quando está desabilitado");
  };
  prisma.systemSetting.findMany = async () => [
    {
      id: "s1",
      key: "client_portal_dashboard_show_recent_history",
      value: "false",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const result = await getClientDashboard("user-1");

  assert.deepEqual(result.recentHistory, []);
});

test("rota GET /dashboard exige authenticate e apenas CLIENTE pode acessar", () => {
  // Verifica que o router-level middleware inclui authorizeRoles(CLIENT)
  const routerMiddleware = clientPortalRoutes.stack.filter((layer) => !layer.route);

  assert.ok(
    routerMiddleware.length >= 3,
    "deve ter middlewares de authenticate, authorizeRoles e portal enabled",
  );

  // Verifica que authorizeRoles(CLIENT) rejeita ADMIN com ForbiddenError
  const req = { user: { role: ROLES.ADMIN } };
  const next = (err) => {
    assert.ok(err, "deve chamar next com erro para ADMIN");
  };

  authorizeRoles(ROLES.CLIENT)(req, {}, next);

  const professionalReq = { user: { role: ROLES.PROFESSIONAL } };
  const nextProfessional = (err) => {
    assert.ok(err, "deve chamar next com erro para PROFESSIONAL");
  };

  authorizeRoles(ROLES.CLIENT)(professionalReq, {}, nextProfessional);
});

test("rota GET /config existe sem auth obrigatória", () => {
  const configRoute = clientPortalRoutes.stack.find(
    (entry) => entry.route?.path === "/config" && entry.route.methods?.get,
  );

  assert.ok(configRoute, "deve expor GET /config");
});

test("ensureClientPortalEnabled bloqueia o portal quando client_portal_enabled=false", async (t) => {
  const original = prisma.systemSetting.findMany;

  t.after(() => {
    prisma.systemSetting.findMany = original;
  });

  prisma.systemSetting.findMany = async () => [
    {
      id: "setting-1",
      key: "client_portal_enabled",
      value: "false",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  await new Promise((resolve, reject) => {
    ensureClientPortalEnabled({}, {}, (error) => {
      try {
        assert.ok(error);
        assert.equal(error.statusCode, 503);
        assert.equal(error.message, "Portal do Cliente temporariamente indisponível.");
        resolve();
      } catch (assertionError) {
        reject(assertionError);
      }
    });
  });
});
