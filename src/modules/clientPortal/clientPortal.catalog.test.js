import assert from "node:assert/strict";
import test from "node:test";

import prisma from "../../database/prisma.js";
import { BadRequestError } from "../../errors/BadRequestError.js";
import { ConflictError } from "../../errors/ConflictError.js";
import { ValidationError } from "../../errors/ValidationError.js";
import {
  cancelOwnAppointment,
  createOwnClientAppointment,
  getClientPortalAvailability,
  listClientAppointments,
  listClientPortalProfessionals,
  listClientPortalServices,
} from "./clientPortal.service.js";
import {
  validateClientPortalAvailabilityQuery,
  validateCreateClientPortalAppointment,
  validateListClientAppointmentsQuery,
} from "./clientPortal.validator.js";

function stubClientProfile() {
  return { id: "client-1", userId: "user-1" };
}

function makePortalAppointment(overrides = {}) {
  return {
    id: overrides.id ?? "appt-1",
    clientId: overrides.clientId ?? "client-1",
    professionalId: overrides.professionalId ?? "prof-1",
    serviceId: overrides.serviceId ?? "svc-1",
    startAt: overrides.startAt ?? new Date("2099-06-30T09:00:00.000Z"),
    endAt: overrides.endAt ?? new Date("2099-06-30T09:30:00.000Z"),
    status: overrides.status ?? "SCHEDULED",
    notes: overrides.notes ?? null,
    professional: overrides.professional ?? { id: "prof-1", name: "João" },
    service: overrides.service ?? { id: "svc-1", name: "Corte" },
    client: overrides.client ?? { id: "client-1", name: "Cliente Teste" },
  };
}

test("listClientPortalServices retorna apenas campos seguros para o cliente", async (t) => {
  const origClient = prisma.client.findFirst;
  const origServices = prisma.service.findMany;

  t.after(() => {
    prisma.client.findFirst = origClient;
    prisma.service.findMany = origServices;
  });

  prisma.client.findFirst = async () => stubClientProfile();
  prisma.service.findMany = async () => [
    {
      id: "svc-1",
      name: "Corte",
      description: "Corte clássico",
      durationMinutes: 30,
      price: 50,
      status: "ACTIVE",
    },
  ];

  const result = await listClientPortalServices("user-1");

  assert.deepEqual(result, {
    items: [
      {
        id: "svc-1",
        name: "Corte",
        description: "Corte clássico",
        durationMinutes: 30,
        priceCents: 5000,
      },
    ],
  });
  assert.equal("status" in result.items[0], false);
});

test("listClientPortalProfessionals retorna apenas campos seguros para o cliente", async (t) => {
  const origClient = prisma.client.findFirst;
  const origProfessionals = prisma.professional.findMany;

  t.after(() => {
    prisma.client.findFirst = origClient;
    prisma.professional.findMany = origProfessionals;
  });

  prisma.client.findFirst = async () => stubClientProfile();
  prisma.professional.findMany = async () => [
    {
      id: "prof-1",
      name: "João",
      specialty: "Barbeiro",
      phone: "11999999999",
      userId: "user-prof-1",
      appointmentIntervalMinutes: 30,
    },
  ];

  const result = await listClientPortalProfessionals("user-1");

  assert.deepEqual(result, {
    items: [
      {
        id: "prof-1",
        name: "João",
        specialty: "Barbeiro",
        photoUrl: null,
      },
    ],
  });
  assert.equal("phone" in result.items[0], false);
  assert.equal("userId" in result.items[0], false);
});

test("validateClientPortalAvailabilityQuery exige professionalId, serviceId e date", () => {
  assert.throws(
    () => validateClientPortalAvailabilityQuery({}),
    ValidationError,
  );
});

test("validateCreateClientPortalAppointment ignora clientId externo", () => {
  const result = validateCreateClientPortalAppointment({
    clientId: "outro-client",
    professionalId: "prof-1",
    serviceId: "svc-1",
    date: "2026-06-30",
    time: "09:00",
    notes: "teste",
  });

  assert.equal(result.clientId, undefined);
  assert.equal(result.professionalId, "prof-1");
});

test("validateListClientAppointmentsQuery ignora clientId externo", () => {
  const result = validateListClientAppointmentsQuery({
    clientId: "outro-client",
    page: 2,
    limit: 5,
    status: "SCHEDULED",
  });

  assert.equal(result.clientId, undefined);
  assert.equal(result.page, 2);
  assert.equal(result.limit, 5);
  assert.equal(result.status, "SCHEDULED");
});

test("getClientPortalAvailability bloqueia profissional inativo", async (t) => {
  const origClient = prisma.client.findFirst;
  const origProfessional = prisma.professional.findFirst;

  t.after(() => {
    prisma.client.findFirst = origClient;
    prisma.professional.findFirst = origProfessional;
  });

  prisma.client.findFirst = async () => stubClientProfile();
  prisma.professional.findFirst = async () => ({
    id: "prof-1",
    status: "INACTIVE",
    appointmentIntervalMinutes: 30,
  });

  await assert.rejects(
    () =>
      getClientPortalAvailability(
        { professionalId: "prof-1", serviceId: "svc-1", date: "2026-06-23" },
        "user-1",
      ),
    BadRequestError,
  );
});

test("getClientPortalAvailability bloqueia serviço inativo", async (t) => {
  const origClient = prisma.client.findFirst;
  const origProfessional = prisma.professional.findFirst;
  const origService = prisma.service.findFirst;

  t.after(() => {
    prisma.client.findFirst = origClient;
    prisma.professional.findFirst = origProfessional;
    prisma.service.findFirst = origService;
  });

  prisma.client.findFirst = async () => stubClientProfile();
  prisma.professional.findFirst = async () => ({
    id: "prof-1",
    status: "ACTIVE",
    appointmentIntervalMinutes: 30,
  });
  prisma.service.findFirst = async () => ({
    id: "svc-1",
    status: "INACTIVE",
    durationMinutes: 60,
  });

  await assert.rejects(
    () =>
      getClientPortalAvailability(
        { professionalId: "prof-1", serviceId: "svc-1", date: "2026-06-23" },
        "user-1",
      ),
    BadRequestError,
  );
});

test("getClientPortalAvailability reaproveita a disponibilidade com duração real do serviço", async (t) => {
  const origClient = prisma.client.findFirst;
  const origProfessional = prisma.professional.findFirst;
  const origService = prisma.service.findFirst;
  const origAppointments = prisma.appointment.findMany;
  const origScheduleBlocks = prisma.scheduleBlock.findMany;
  const origRecurringBlocks = prisma.professionalRecurringBlock.findMany;
  const origSchedule = prisma.professionalSchedule.findFirst;
  const origSettings = prisma.systemSetting.findMany;

  t.after(() => {
    prisma.client.findFirst = origClient;
    prisma.professional.findFirst = origProfessional;
    prisma.service.findFirst = origService;
    prisma.appointment.findMany = origAppointments;
    prisma.scheduleBlock.findMany = origScheduleBlocks;
    prisma.professionalRecurringBlock.findMany = origRecurringBlocks;
    prisma.professionalSchedule.findFirst = origSchedule;
    prisma.systemSetting.findMany = origSettings;
  });

  prisma.client.findFirst = async () => stubClientProfile();
  prisma.professional.findFirst = async () => ({
    id: "prof-1",
    status: "ACTIVE",
    appointmentIntervalMinutes: 30,
  });
  prisma.service.findFirst = async () => ({
    id: "svc-1",
    status: "ACTIVE",
    durationMinutes: 60,
  });
  prisma.appointment.findMany = async () => [];
  prisma.scheduleBlock.findMany = async () => [];
  prisma.professionalRecurringBlock.findMany = async () => [];
  prisma.professionalSchedule.findFirst = async () => ({
    id: "sched-1",
    openTime: "09:00",
    closeTime: "11:00",
  });
  prisma.systemSetting.findMany = async () => [];

  const result = await getClientPortalAvailability(
    { professionalId: "prof-1", serviceId: "svc-1", date: "2026-06-23" },
    "user-1",
  );

  assert.deepEqual(result, {
    date: "2026-06-23",
    professionalId: "prof-1",
    serviceId: "svc-1",
    slots: [
      { time: "09:00", available: true },
      { time: "09:30", available: true },
      { time: "10:00", available: true },
    ],
  });
});

test("createOwnClientAppointment cria agendamento válido para o client autenticado com status SCHEDULED", async (t) => {
  const origClient = prisma.client.findFirst;
  const origService = prisma.service.findFirst;
  const origProfessional = prisma.professional.findFirst;
  const origSettings = prisma.systemSetting.findMany;
  const origScheduleBlock = prisma.scheduleBlock.findFirst;
  const origAppointmentFindFirst = prisma.appointment.findFirst;
  const origAppointmentCreate = prisma.appointment.create;
  const origUserFindMany = prisma.user.findMany;
  const origReminderUpdateMany = prisma.appointmentReminder.updateMany;

  t.after(() => {
    prisma.client.findFirst = origClient;
    prisma.service.findFirst = origService;
    prisma.professional.findFirst = origProfessional;
    prisma.systemSetting.findMany = origSettings;
    prisma.scheduleBlock.findFirst = origScheduleBlock;
    prisma.appointment.findFirst = origAppointmentFindFirst;
    prisma.appointment.create = origAppointmentCreate;
    prisma.user.findMany = origUserFindMany;
    prisma.appointmentReminder.updateMany = origReminderUpdateMany;
  });

  prisma.client.findFirst = async () => stubClientProfile();
  prisma.service.findFirst = async () => ({
    id: "svc-1",
    name: "Corte",
    status: "ACTIVE",
    durationMinutes: 30,
  });
  prisma.professional.findFirst = async () => ({
    id: "prof-1",
    status: "ACTIVE",
    appointmentIntervalMinutes: 30,
    schedules: [{ id: "sched-1", openTime: "09:00", closeTime: "18:00" }],
    recurringBlocks: [],
  });
  prisma.systemSetting.findMany = async () => [
    { key: "appointment_reminder_enabled", value: "false" },
  ];
  prisma.scheduleBlock.findFirst = async () => null;
  prisma.appointment.findFirst = async (...args) => {
    const [query] = args;

    if (query?.where?.clientId && query?.where?.serviceId) {
      return null;
    }

    return null;
  };
  prisma.appointment.create = async ({ data }) => ({
    id: "appt-1",
    clientId: data.clientId,
    professionalId: data.professionalId,
    serviceId: data.serviceId,
    startAt: data.startAt,
    endAt: data.endAt,
    status: data.status,
    notes: data.notes,
    professional: { id: "prof-1", name: "João" },
    service: { id: "svc-1", name: "Corte" },
    client: { id: "client-1", name: "Cliente Teste" },
  });
  prisma.user.findMany = async () => [];
  prisma.appointmentReminder.updateMany = async () => ({ count: 0 });

  const result = await createOwnClientAppointment(
    {
      professionalId: "prof-1",
      serviceId: "svc-1",
      date: "2099-06-30",
      time: "09:00",
      notes: "Preferência por manhã",
    },
    "user-1",
  );

  assert.deepEqual(result, {
    appointment: {
      id: "appt-1",
      date: "2099-06-30",
      time: "09:00",
      status: "SCHEDULED",
      professionalName: "João",
      serviceName: "Corte",
    },
  });
});

test("createOwnClientAppointment bloqueia serviço inativo", async (t) => {
  const origClient = prisma.client.findFirst;
  const origService = prisma.service.findFirst;

  t.after(() => {
    prisma.client.findFirst = origClient;
    prisma.service.findFirst = origService;
  });

  prisma.client.findFirst = async () => stubClientProfile();
  prisma.service.findFirst = async () => ({
    id: "svc-1",
    status: "INACTIVE",
    durationMinutes: 30,
  });

  await assert.rejects(
    () =>
      createOwnClientAppointment(
        {
          professionalId: "prof-1",
          serviceId: "svc-1",
          date: "2099-06-30",
          time: "09:00",
          notes: null,
        },
        "user-1",
      ),
    BadRequestError,
  );
});

test("createOwnClientAppointment bloqueia horário indisponível por overlap parcial", async (t) => {
  const origClient = prisma.client.findFirst;
  const origService = prisma.service.findFirst;
  const origProfessional = prisma.professional.findFirst;
  const origSettings = prisma.systemSetting.findMany;
  const origScheduleBlock = prisma.scheduleBlock.findFirst;
  const origAppointmentFindFirst = prisma.appointment.findFirst;

  t.after(() => {
    prisma.client.findFirst = origClient;
    prisma.service.findFirst = origService;
    prisma.professional.findFirst = origProfessional;
    prisma.systemSetting.findMany = origSettings;
    prisma.scheduleBlock.findFirst = origScheduleBlock;
    prisma.appointment.findFirst = origAppointmentFindFirst;
  });

  prisma.client.findFirst = async () => stubClientProfile();
  prisma.service.findFirst = async () => ({
    id: "svc-1",
    status: "ACTIVE",
    durationMinutes: 60,
  });
  prisma.professional.findFirst = async () => ({
    id: "prof-1",
    status: "ACTIVE",
    appointmentIntervalMinutes: 30,
    schedules: [{ id: "sched-1", openTime: "09:00", closeTime: "18:00" }],
    recurringBlocks: [],
  });
  prisma.systemSetting.findMany = async () => [];
  prisma.scheduleBlock.findFirst = async () => null;
  prisma.appointment.findFirst = async (...args) => {
    const [query] = args;

    if (query?.where?.clientId && query?.where?.serviceId) {
      return null;
    }

    return {
      id: "appt-existing",
      startAt: new Date("2099-06-30T12:00:00.000Z"),
      endAt: new Date("2099-06-30T13:00:00.000Z"),
      status: "SCHEDULED",
    };
  };

  await assert.rejects(
    () =>
      createOwnClientAppointment(
        {
          professionalId: "prof-1",
          serviceId: "svc-1",
          date: "2099-06-30",
          time: "09:30",
          notes: null,
        },
        "user-1",
      ),
    ConflictError,
  );
});

test("createOwnClientAppointment não permite criar no passado", async (t) => {
  const origClient = prisma.client.findFirst;
  const origService = prisma.service.findFirst;
  const origAppointmentFindFirst = prisma.appointment.findFirst;

  t.after(() => {
    prisma.client.findFirst = origClient;
    prisma.service.findFirst = origService;
    prisma.appointment.findFirst = origAppointmentFindFirst;
  });

  prisma.client.findFirst = async () => stubClientProfile();
  prisma.service.findFirst = async () => ({
    id: "svc-1",
    status: "ACTIVE",
    durationMinutes: 30,
  });
  prisma.appointment.findFirst = async () => null;

  await assert.rejects(
    () =>
      createOwnClientAppointment(
        {
          professionalId: "prof-1",
          serviceId: "svc-1",
          date: "2020-06-30",
          time: "09:00",
          notes: null,
        },
        "user-1",
      ),
    BadRequestError,
  );
});

test("listClientAppointments retorna apenas agendamentos do cliente autenticado com statusLabel e canCancel", async (t) => {
  const origClient = prisma.client.findFirst;
  const origAppointmentFindMany = prisma.appointment.findMany;
  const origAppointmentCount = prisma.appointment.count;
  let receivedWhere = null;

  t.after(() => {
    prisma.client.findFirst = origClient;
    prisma.appointment.findMany = origAppointmentFindMany;
    prisma.appointment.count = origAppointmentCount;
  });

  prisma.client.findFirst = async () => stubClientProfile();
  prisma.appointment.findMany = async ({ where }) => {
    receivedWhere = where;

    return [
      makePortalAppointment({ id: "appt-1", status: "SCHEDULED" }),
      makePortalAppointment({ id: "appt-2", status: "CONFIRMED" }),
      makePortalAppointment({ id: "appt-3", status: "CANCELED" }),
      makePortalAppointment({ id: "appt-4", status: "FINISHED" }),
      makePortalAppointment({ id: "appt-5", status: "NO_SHOW" }),
      makePortalAppointment({ id: "appt-6", status: "IN_ATTENDANCE" }),
      makePortalAppointment({
        id: "appt-7",
        status: "SCHEDULED",
        startAt: new Date("2020-06-30T09:00:00.000Z"),
        endAt: new Date("2020-06-30T09:30:00.000Z"),
      }),
    ];
  };
  prisma.appointment.count = async () => 7;

  const result = await listClientAppointments(
    { page: 1, limit: 10, status: "SCHEDULED", clientId: "other-client" },
    "user-1",
  );

  assert.equal(receivedWhere.clientId, "client-1");
  assert.equal(receivedWhere.service.deletedAt, null);
  assert.equal(receivedWhere.professional.deletedAt, null);
  assert.equal(result.items[0].statusLabel, "Agendado");
  assert.equal(result.items[1].statusLabel, "Confirmado");
  assert.equal(result.items[4].statusLabel, "Não compareceu");
  assert.equal(result.items[0].canCancel, true);
  assert.equal(result.items[1].canCancel, true);
  assert.equal(result.items[2].canCancel, false);
  assert.equal(result.items[3].canCancel, false);
  assert.equal(result.items[4].canCancel, false);
  assert.equal(result.items[5].canCancel, false);
  assert.equal(result.items[6].canCancel, false);
});

test("cancelOwnAppointment cancela agendamento próprio mudando status para CANCELED sem delete físico", async (t) => {
  const origClient = prisma.client.findFirst;
  const origSettingFindUnique = prisma.systemSetting.findUnique;
  const origAppointmentFindFirst = prisma.appointment.findFirst;
  const origAppointmentUpdate = prisma.appointment.update;
  const origAppointmentDelete = prisma.appointment.delete;
  const origReminderUpdateMany = prisma.appointmentReminder.updateMany;
  const origUserFindMany = prisma.user.findMany;
  let deleteCalled = false;

  t.after(() => {
    prisma.client.findFirst = origClient;
    prisma.systemSetting.findUnique = origSettingFindUnique;
    prisma.appointment.findFirst = origAppointmentFindFirst;
    prisma.appointment.update = origAppointmentUpdate;
    prisma.appointment.delete = origAppointmentDelete;
    prisma.appointmentReminder.updateMany = origReminderUpdateMany;
    prisma.user.findMany = origUserFindMany;
  });

  prisma.client.findFirst = async () => ({ ...stubClientProfile(), name: "Cliente Teste" });
  prisma.systemSetting.findUnique = async () => null;
  prisma.appointment.findFirst = async () => makePortalAppointment({ status: "SCHEDULED" });
  prisma.appointment.update = async ({ data }) =>
    makePortalAppointment({ status: data.status });
  prisma.appointment.delete = async () => {
    deleteCalled = true;
    return null;
  };
  prisma.appointmentReminder.updateMany = async () => ({ count: 1 });
  prisma.user.findMany = async () => [];

  const result = await cancelOwnAppointment("appt-1", "user-1");

  assert.deepEqual(result, {
    appointment: {
      id: "appt-1",
      status: "CANCELED",
      statusLabel: "Cancelado",
    },
  });
  assert.equal(deleteCalled, false);
});

test("cancelOwnAppointment não permite cancelar agendamento de outro cliente", async (t) => {
  const origClient = prisma.client.findFirst;
  const origSettingFindUnique = prisma.systemSetting.findUnique;
  const origAppointmentFindFirst = prisma.appointment.findFirst;

  t.after(() => {
    prisma.client.findFirst = origClient;
    prisma.systemSetting.findUnique = origSettingFindUnique;
    prisma.appointment.findFirst = origAppointmentFindFirst;
  });

  prisma.client.findFirst = async () => stubClientProfile();
  prisma.systemSetting.findUnique = async () => null;
  prisma.appointment.findFirst = async () =>
    makePortalAppointment({ clientId: "client-2", client: { id: "client-2", name: "Outro" } });

  await assert.rejects(() => cancelOwnAppointment("appt-1", "user-1"));
});

for (const blockedStatus of ["FINISHED", "NO_SHOW", "IN_ATTENDANCE", "CANCELED"]) {
  test(`cancelOwnAppointment bloqueia status ${blockedStatus}`, async (t) => {
    const origClient = prisma.client.findFirst;
    const origSettingFindUnique = prisma.systemSetting.findUnique;
    const origAppointmentFindFirst = prisma.appointment.findFirst;

    t.after(() => {
      prisma.client.findFirst = origClient;
      prisma.systemSetting.findUnique = origSettingFindUnique;
      prisma.appointment.findFirst = origAppointmentFindFirst;
    });

    prisma.client.findFirst = async () => stubClientProfile();
    prisma.systemSetting.findUnique = async () => null;
    prisma.appointment.findFirst = async () => makePortalAppointment({ status: blockedStatus });

    await assert.rejects(() => cancelOwnAppointment("appt-1", "user-1"), BadRequestError);
  });
}

test("cancelOwnAppointment bloqueia agendamento passado", async (t) => {
  const origClient = prisma.client.findFirst;
  const origSettingFindUnique = prisma.systemSetting.findUnique;
  const origAppointmentFindFirst = prisma.appointment.findFirst;

  t.after(() => {
    prisma.client.findFirst = origClient;
    prisma.systemSetting.findUnique = origSettingFindUnique;
    prisma.appointment.findFirst = origAppointmentFindFirst;
  });

  prisma.client.findFirst = async () => stubClientProfile();
  prisma.systemSetting.findUnique = async () => null;
  prisma.appointment.findFirst = async () =>
    makePortalAppointment({
      status: "SCHEDULED",
      startAt: new Date("2020-06-30T09:00:00.000Z"),
      endAt: new Date("2020-06-30T09:30:00.000Z"),
    });

  await assert.rejects(() => cancelOwnAppointment("appt-1", "user-1"), BadRequestError);
});
