import assert from "node:assert/strict";
import test from "node:test";

import prisma from "../../database/prisma.js";
import { APPOINTMENT_STATUS } from "../../constants/appointmentStatus.js";
import { BadRequestError } from "../../errors/BadRequestError.js";
import { ConflictError } from "../../errors/ConflictError.js";
import {
  assertAppointmentSlotAvailability,
  buildCalendarDays,
  createAppointment,
  generateSlots,
  getUpcomingAppointmentAlerts,
  groupAppointmentsByBusinessDay,
  rescheduleAppointment,
  resolveAppointmentIntervalMinutes,
  summarizeAppointmentsByBusinessDay,
  updateAppointment,
  updateAppointmentStatus,
} from "./appointment.service.js";

function buildAppointment(id, startAtIso, status = "SCHEDULED") {
  return {
    id,
    startAt: new Date(startAtIso),
    status,
  };
}

test("buildCalendarDays preserva os dias de negócio locais no range informado", () => {
  assert.deepEqual(buildCalendarDays("2026-06-23", "2026-06-24"), [
    "2026-06-23",
    "2026-06-24",
  ]);
});

test("agrupa agendamento das 22:30 locais no dia 2026-06-23", () => {
  const appointments = [
    buildAppointment("night-2230", "2026-06-24T01:30:00.000Z"),
  ];

  const grouped = groupAppointmentsByBusinessDay(appointments, "2026-06-23", "2026-06-24");

  assert.equal(grouped[0].date, "2026-06-23");
  assert.equal(grouped[0].appointments.length, 1);
  assert.equal(grouped[0].appointments[0].id, "night-2230");
  assert.equal(grouped[1].date, "2026-06-24");
  assert.equal(grouped[1].appointments.length, 0);
});

test("agendamento noturno local não vaza para o dia seguinte local", () => {
  const appointments = [
    buildAppointment("night-2230", "2026-06-24T01:30:00.000Z"),
  ];

  const grouped = groupAppointmentsByBusinessDay(appointments, "2026-06-24", "2026-06-24");

  assert.equal(grouped[0].date, "2026-06-24");
  assert.equal(grouped[0].appointments.length, 0);
});

test("agendamento da manhã continua aparecendo no mesmo dia local", () => {
  const appointments = [
    buildAppointment("morning-0900", "2026-06-23T12:00:00.000Z"),
  ];

  const grouped = groupAppointmentsByBusinessDay(appointments, "2026-06-23", "2026-06-23");

  assert.equal(grouped[0].appointments.length, 1);
  assert.equal(grouped[0].appointments[0].id, "morning-0900");
});

test("agendamento das 23:30 locais aparece no fim do dia local correto", () => {
  const appointments = [
    buildAppointment("night-2330", "2026-06-24T02:30:00.000Z"),
  ];

  const grouped = groupAppointmentsByBusinessDay(appointments, "2026-06-23", "2026-06-23");

  assert.equal(grouped[0].appointments.length, 1);
  assert.equal(grouped[0].appointments[0].id, "night-2330");
});

test("resumo mensal agrupa UTC da madrugada no dia local anterior", () => {
  const rows = [
    buildAppointment("night-2200", "2026-06-24T01:00:00.000Z", "CONFIRMED"),
    buildAppointment("night-2230", "2026-06-24T01:30:00.000Z", "SCHEDULED"),
    buildAppointment("night-2330", "2026-06-24T02:30:00.000Z", "SCHEDULED"),
  ];

  const summary = summarizeAppointmentsByBusinessDay(rows);

  assert.equal(summary.length, 1);
  assert.equal(summary[0].date, "2026-06-23");
  assert.equal(summary[0].total, 3);
  assert.equal(summary[0].byStatus.CONFIRMED, 1);
  assert.equal(summary[0].byStatus.SCHEDULED, 2);
});

// ─── resolveAppointmentIntervalMinutes ────────────────────────────────────────

function buildSettings(intervalMinutes = 30) {
  return { appointmentIntervalMinutes: intervalMinutes };
}

test("usa intervalo do profissional quando está definido", () => {
  const result = resolveAppointmentIntervalMinutes(
    { appointmentIntervalMinutes: 15 },
    buildSettings(30),
  );
  assert.equal(result, 15);
});

test("usa intervalo global quando profissional tem null", () => {
  const result = resolveAppointmentIntervalMinutes(
    { appointmentIntervalMinutes: null },
    buildSettings(30),
  );
  assert.equal(result, 30);
});

test("usa intervalo global quando profissional não tem o campo", () => {
  const result = resolveAppointmentIntervalMinutes(
    {},
    buildSettings(20),
  );
  assert.equal(result, 20);
});

test("usa intervalo global quando professional é null", () => {
  const result = resolveAppointmentIntervalMinutes(null, buildSettings(45));
  assert.equal(result, 45);
});

test("fallback de settings.appointmentIntervalMinutes quando ambos ausentes usa o padrão já embutido em toAvailabilitySettings (5)", () => {
  // toAvailabilitySettings já garante mínimo 1 e fallback de 5;
  // aqui apenas verificamos que resolveAppointmentIntervalMinutes repassa corretamente
  const result = resolveAppointmentIntervalMinutes(
    { appointmentIntervalMinutes: null },
    buildSettings(5),
  );
  assert.equal(result, 5);
});

test("intervalo do profissional de 0 é ignorado — usa fallback global", () => {
  // 0 não é um intervalo válido; a guarda é Number.isInteger(own) && own > 0
  const result = resolveAppointmentIntervalMinutes(
    { appointmentIntervalMinutes: 0 },
    buildSettings(30),
  );
  assert.equal(result, 30);
});

test("intervalo do profissional negativo é ignorado — usa fallback global", () => {
  const result = resolveAppointmentIntervalMinutes(
    { appointmentIntervalMinutes: -10 },
    buildSettings(30),
  );
  assert.equal(result, 30);
});

test("não regressão: serviço de 60 min com intervalo efetivo 30 — profissional com intervalo 30", () => {
  const result = resolveAppointmentIntervalMinutes(
    { appointmentIntervalMinutes: 30 },
    buildSettings(60),
  );
  assert.equal(result, 30);
});

// ─── generateSlots — timezone, duração, sobreposição ─────────────────────────
// Junho 2026 = inverno brasileiro = UTC-3
// "2026-06-23T09:00" local = "2026-06-23T12:00:00.000Z"
// "2026-06-23T18:00" local = "2026-06-23T21:00:00.000Z"
// "2026-06-23T22:00" local = "2026-06-24T01:00:00.000Z"

const DATE = "2026-06-23";

function utc(iso) {
  return new Date(iso);
}

test("slot noturno às 22:00 local tem UTC correto (2026-06-24T01:00:00.000Z)", () => {
  const slots = generateSlots(DATE, 30, 30, "09:00", "23:00", [], []);
  const found = slots.find((s) => s.startAt === "2026-06-24T01:00:00.000Z");
  assert.ok(found, "slot das 22:00 local não foi gerado");
  assert.equal(found.endAt, "2026-06-24T01:30:00.000Z");
});

test("slot às 23:30 local gerado dentro do expediente até 23:59", () => {
  const slots = generateSlots(DATE, 20, 30, "23:00", "23:59", [], []);
  const found = slots.find((s) => s.startAt === "2026-06-24T02:30:00.000Z");
  assert.ok(found, "slot das 23:30 local não foi gerado");
});

test("slot às 17:00 com serviço de 60 min é gerado quando expediente encerra às 18:00", () => {
  const slots = generateSlots(DATE, 60, 30, "09:00", "18:00", [], []);
  const found = slots.find((s) => s.startAt === "2026-06-23T20:00:00.000Z");
  assert.ok(found, "slot das 17:00 local deve ser gerado (encerra exato às 18:00)");
});

test("slot às 17:30 com serviço de 60 min NÃO é gerado quando expediente encerra às 18:00", () => {
  const slots = generateSlots(DATE, 60, 30, "09:00", "18:00", [], []);
  const found = slots.find((s) => s.startAt === "2026-06-23T20:30:00.000Z");
  assert.equal(found, undefined, "slot das 17:30 não deve ser gerado (18:30 > 18:00)");
});

test("conflito: serviço 60 min bloqueia slot 09:00 quando existe agendamento 09:00-10:00", () => {
  const existing = [{ startAt: utc("2026-06-23T12:00:00.000Z"), endAt: utc("2026-06-23T13:00:00.000Z") }];
  const slots = generateSlots(DATE, 60, 30, "09:00", "18:00", existing, []);
  const blocked = slots.find((s) => s.startAt === "2026-06-23T12:00:00.000Z");
  assert.equal(blocked, undefined, "slot 09:00 deve estar bloqueado");
});

test("conflito parcial: slot 09:30 com serviço 60 min bloqueado por agendamento 09:00-10:00", () => {
  const existing = [{ startAt: utc("2026-06-23T12:00:00.000Z"), endAt: utc("2026-06-23T13:00:00.000Z") }];
  const slots = generateSlots(DATE, 60, 30, "09:00", "18:00", existing, []);
  const blocked = slots.find((s) => s.startAt === "2026-06-23T12:30:00.000Z");
  assert.equal(blocked, undefined, "slot 09:30 deve estar bloqueado");
});

test("borda exata: slot 10:00 está disponível quando agendamento é 09:00-10:00", () => {
  const existing = [{ startAt: utc("2026-06-23T12:00:00.000Z"), endAt: utc("2026-06-23T13:00:00.000Z") }];
  const slots = generateSlots(DATE, 60, 30, "09:00", "18:00", existing, []);
  const available = slots.find((s) => s.startAt === "2026-06-23T13:00:00.000Z");
  assert.ok(available, "slot 10:00 deve estar disponível (endAt=startAt não é conflito)");
});

test("serviço de 90 min bloqueia slots parcialmente sobrepostos com agendamento 10:00-11:00", () => {
  const existing = [{ startAt: utc("2026-06-23T13:00:00.000Z"), endAt: utc("2026-06-23T14:00:00.000Z") }];
  const slots = generateSlots(DATE, 90, 30, "09:00", "18:00", existing, []);
  const s0900 = slots.find((s) => s.startAt === "2026-06-23T12:00:00.000Z");
  const s1100 = slots.find((s) => s.startAt === "2026-06-23T14:00:00.000Z");
  assert.equal(s0900, undefined, "slot 09:00 deve estar bloqueado (90 min cruza com 10:00-11:00)");
  assert.ok(s1100, "slot 11:00 deve estar disponível");
});

test("intervalo de 15 min gera slots a cada 15 minutos", () => {
  const slots = generateSlots(DATE, 15, 15, "09:00", "10:00", [], []);
  const starts = slots.map((s) => s.startAt);
  assert.ok(starts.includes("2026-06-23T12:00:00.000Z"), "09:00 deve ser slot");
  assert.ok(starts.includes("2026-06-23T12:15:00.000Z"), "09:15 deve ser slot");
  assert.ok(starts.includes("2026-06-23T12:30:00.000Z"), "09:30 deve ser slot");
  assert.ok(starts.includes("2026-06-23T12:45:00.000Z"), "09:45 deve ser slot");
  assert.equal(slots.length, 4, "deve haver exatamente 4 slots de 15 min entre 09:00 e 10:00");
});

test("bloco de horário (scheduleBlock UTC) bloqueia slots corretamente", () => {
  const blocks = [{ startAt: utc("2026-06-23T13:00:00.000Z"), endAt: utc("2026-06-23T14:00:00.000Z") }];
  const slots = generateSlots(DATE, 30, 30, "09:00", "18:00", [], blocks);
  const s1000 = slots.find((s) => s.startAt === "2026-06-23T13:00:00.000Z");
  const s1030 = slots.find((s) => s.startAt === "2026-06-23T13:30:00.000Z");
  const s1100 = slots.find((s) => s.startAt === "2026-06-23T14:00:00.000Z");
  assert.equal(s1000, undefined, "slot 10:00 deve estar bloqueado pelo scheduleBlock");
  assert.equal(s1030, undefined, "slot 10:30 deve estar bloqueado pelo scheduleBlock");
  assert.ok(s1100, "slot 11:00 deve estar disponível após o bloco");
});

test("sem slots quando expediente encerra antes de começar (degenerado)", () => {
  const slots = generateSlots(DATE, 30, 30, "18:00", "09:00", [], []);
  assert.equal(slots.length, 0, "expediente invertido deve retornar zero slots");
});

function buildActor(role = "ADMIN", id = "user-admin") {
  return { id, role };
}

function buildRescheduleAppointment(overrides = {}) {
  return {
    id: "apt-1",
    clientId: "client-1",
    professionalId: "pro-1",
    serviceId: "service-1",
    startAt: new Date("2026-06-23T12:00:00.000Z"),
    endAt: new Date("2026-06-23T13:00:00.000Z"),
    status: APPOINTMENT_STATUS.SCHEDULED,
    service: {
      id: "service-1",
      durationMinutes: 60,
    },
    ...overrides,
  };
}

function buildEditableAppointment(overrides = {}) {
  return {
    id: "apt-edit-1",
    clientId: "client-1",
    professionalId: "pro-1",
    serviceId: "service-1",
    startAt: new Date("2026-06-23T12:00:00.000Z"),
    endAt: new Date("2026-06-23T13:00:00.000Z"),
    status: APPOINTMENT_STATUS.SCHEDULED,
    notes: "Observacao",
    client: { id: "client-1", name: "Cliente" },
    professional: { id: "pro-1", name: "Profissional" },
    service: { id: "service-1", name: "Corte", durationMinutes: 60, price: 50 },
    ...overrides,
  };
}

function stubUpdateAppointmentDependencies(t, options = {}) {
  const state = {
    appointmentFindFirstCalls: [],
    appointmentUpdateCalls: [],
  };
  const currentAppointment = options.currentAppointment ?? buildEditableAppointment();
  const updatedAppointment = options.updatedAppointment ?? {
    ...currentAppointment,
    ...options.updatedAppointmentOverrides,
  };
  const saved = {
    appointmentFindFirst: prisma.appointment.findFirst,
    appointmentUpdate: prisma.appointment.update,
    clientFindFirst: prisma.client.findFirst,
    professionalFindFirst: prisma.professional.findFirst,
    serviceFindFirst: prisma.service.findFirst,
    scheduleBlockFindFirst: prisma.scheduleBlock.findFirst,
  };

  t.after(() => {
    prisma.appointment.findFirst = saved.appointmentFindFirst;
    prisma.appointment.update = saved.appointmentUpdate;
    prisma.client.findFirst = saved.clientFindFirst;
    prisma.professional.findFirst = saved.professionalFindFirst;
    prisma.service.findFirst = saved.serviceFindFirst;
    prisma.scheduleBlock.findFirst = saved.scheduleBlockFindFirst;
  });

  prisma.appointment.findFirst = async (args) => {
    state.appointmentFindFirstCalls.push(args);

    if (typeof args.where?.id === "string") {
      return currentAppointment;
    }

    return options.conflictingAppointment ?? null;
  };
  prisma.appointment.update = async (args) => {
    state.appointmentUpdateCalls.push(args);
    return {
      ...updatedAppointment,
      ...args.data,
    };
  };
  prisma.client.findFirst = async () => ({
    id: "client-1",
    name: "Cliente",
    status: "ACTIVE",
    userId: "user-client-1",
  });
  prisma.professional.findFirst = async () => ({
    id: "pro-1",
    name: "Profissional",
    status: "ACTIVE",
    userId: "user-pro-1",
    appointmentIntervalMinutes: 30,
  });
  prisma.service.findFirst = async () => ({
    id: "service-1",
    name: "Corte",
    status: "ACTIVE",
    durationMinutes: 60,
    price: 50,
  });
  prisma.scheduleBlock.findFirst = async () => options.scheduleBlockConflict ?? null;

  return state;
}

function createTransactionHarness(options = {}) {
  const state = {
    appointmentFindFirstCalls: [],
    appointmentUpdateCalls: [],
    professionalFindFirstCalls: [],
    systemSettingFindManyCalls: [],
    scheduleBlockFindFirstCalls: [],
  };

  const hasProfessionalOverride = Object.prototype.hasOwnProperty.call(options, "professional");
  const hasAppointmentConflict = Object.prototype.hasOwnProperty.call(options, "appointmentConflict");
  const hasScheduleBlockConflict = Object.prototype.hasOwnProperty.call(options, "scheduleBlockConflict");
  const hasRecurringBlocks = Object.prototype.hasOwnProperty.call(options, "recurringBlocks");
  const hasSettingsOverride = Object.prototype.hasOwnProperty.call(options, "settings");
  const currentAppointment = options.currentAppointment ?? buildRescheduleAppointment();
  const updatedAppointment = options.updatedAppointment ?? {
    ...currentAppointment,
    professionalId: options.updatedProfessionalId ?? currentAppointment.professionalId,
    startAt: options.updatedStartAt ?? new Date("2026-06-24T01:30:00.000Z"),
    endAt: options.updatedEndAt ?? new Date("2026-06-24T02:30:00.000Z"),
    client: { id: currentAppointment.clientId, name: "Cliente" },
    professional: { id: options.updatedProfessionalId ?? currentAppointment.professionalId, name: "Profissional" },
    service: { id: currentAppointment.serviceId, name: "Corte" },
    notes: null,
    createdAt: new Date("2026-06-22T10:00:00.000Z"),
    updatedAt: new Date("2026-06-23T11:00:00.000Z"),
  };

  const tx = {
    appointment: {
      findFirst: async (args) => {
        state.appointmentFindFirstCalls.push(args);

        if (typeof args.where?.id === "string") {
          return currentAppointment;
        }

        return hasAppointmentConflict ? options.appointmentConflict : null;
      },
      update: async (args) => {
        state.appointmentUpdateCalls.push(args);
        return {
          ...updatedAppointment,
          professionalId: args.data.professionalId,
          startAt: args.data.startAt,
          endAt: args.data.endAt,
        };
      },
    },
    professional: {
      findFirst: async (args) => {
        state.professionalFindFirstCalls.push(args);
        return hasProfessionalOverride ? options.professional : {
          id: args.where.id,
          status: "ACTIVE",
          appointmentIntervalMinutes: 30,
          schedules: [
            {
              id: "sched-1",
              openTime: "09:00",
              closeTime: "23:30",
            },
          ],
          recurringBlocks: hasRecurringBlocks ? options.recurringBlocks : [],
        };
      },
    },
    systemSetting: {
      findMany: async (args) => {
        state.systemSettingFindManyCalls.push(args);
        return hasSettingsOverride ? options.settings : [
          { key: "default_open_time", value: "09:00" },
          { key: "default_close_time", value: "18:00" },
          { key: "appointment_interval_minutes", value: "30" },
        ];
      },
    },
    scheduleBlock: {
      findFirst: async (args) => {
        state.scheduleBlockFindFirstCalls.push(args);
        return hasScheduleBlockConflict ? options.scheduleBlockConflict : null;
      },
    },
  };

  return { tx, state };
}

test("assertAppointmentSlotAvailability rejeita data inválida", async () => {
  await assert.rejects(
    () =>
      assertAppointmentSlotAvailability({
        professionalId: "pro-1",
        date: "2026-02-31",
        time: "09:00",
        durationMinutes: 60,
      }),
    (error) => {
      assert.equal(error instanceof BadRequestError, true);
      assert.equal(error.message, "Data inválida.");
      return true;
    },
  );
});

test("assertAppointmentSlotAvailability rejeita horário inválido", async () => {
  await assert.rejects(
    () =>
      assertAppointmentSlotAvailability({
        professionalId: "pro-1",
        date: "2026-06-23",
        time: "24:00",
        durationMinutes: 60,
      }),
    (error) => {
      assert.equal(error instanceof BadRequestError, true);
      assert.equal(error.message, "Horário inválido.");
      return true;
    },
  );
});

test("assertAppointmentSlotAvailability falha quando profissional não existe", async () => {
  const { tx } = createTransactionHarness({ professional: null });

  await assert.rejects(
    () =>
      assertAppointmentSlotAvailability({
        professionalId: "pro-missing",
        date: "2026-06-23",
        time: "09:00",
        durationMinutes: 60,
        prismaOrTx: tx,
      }),
    (error) => {
      assert.equal(error.message, "Profissional não encontrado.");
      return true;
    },
  );
});

test("assertAppointmentSlotAvailability falha quando profissional está inativo", async () => {
  const { tx } = createTransactionHarness({
    professional: {
      id: "pro-1",
      status: "INACTIVE",
      appointmentIntervalMinutes: 30,
      schedules: [{ id: "sched-1", openTime: "09:00", closeTime: "23:00" }],
      recurringBlocks: [],
    },
  });

  await assert.rejects(
    () =>
      assertAppointmentSlotAvailability({
        professionalId: "pro-1",
        date: "2026-06-23",
        time: "09:00",
        durationMinutes: 60,
        prismaOrTx: tx,
      }),
    (error) => {
      assert.equal(error.message, "Profissional inativo.");
      return true;
    },
  );
});

test("assertAppointmentSlotAvailability falha fora do expediente", async () => {
  const { tx } = createTransactionHarness();

  await assert.rejects(
    () =>
      assertAppointmentSlotAvailability({
        professionalId: "pro-1",
        date: "2026-06-23",
        time: "08:30",
        durationMinutes: 60,
        prismaOrTx: tx,
      }),
    (error) => {
      assert.equal(error.message, "Este horário está fora do expediente do profissional.");
      return true;
    },
  );
});

test("assertAppointmentSlotAvailability falha quando a duração ultrapassa o fim do expediente", async () => {
  const { tx } = createTransactionHarness({
    professional: {
      id: "pro-1",
      status: "ACTIVE",
      appointmentIntervalMinutes: 30,
      schedules: [{ id: "sched-1", openTime: "09:00", closeTime: "23:00" }],
      recurringBlocks: [],
    },
  });

  await assert.rejects(
    () =>
      assertAppointmentSlotAvailability({
        professionalId: "pro-1",
        date: "2026-06-23",
        time: "22:30",
        durationMinutes: 60,
        prismaOrTx: tx,
      }),
    (error) => {
      assert.equal(error.message, "Este horário não está disponível para a duração deste serviço.");
      return true;
    },
  );
});

test("assertAppointmentSlotAvailability falha quando há bloqueio manual", async () => {
  const { tx } = createTransactionHarness({
    scheduleBlockConflict: {
      id: "block-1",
      startAt: new Date("2026-06-24T01:00:00.000Z"),
      endAt: new Date("2026-06-24T02:00:00.000Z"),
    },
  });

  await assert.rejects(
    () =>
      assertAppointmentSlotAvailability({
        professionalId: "pro-1",
        date: "2026-06-23",
        time: "22:00",
        durationMinutes: 30,
        prismaOrTx: tx,
      }),
    (error) => {
      assert.equal(error instanceof ConflictError, true);
      assert.equal(error.message, "Este horário está bloqueado.");
      return true;
    },
  );
});

test("assertAppointmentSlotAvailability falha quando há overlap parcial com outro agendamento", async () => {
  const { tx } = createTransactionHarness({
    appointmentConflict: {
      id: "apt-2",
      startAt: new Date("2026-06-23T13:00:00.000Z"),
      endAt: new Date("2026-06-23T14:00:00.000Z"),
      status: APPOINTMENT_STATUS.CONFIRMED,
    },
  });

  await assert.rejects(
    () =>
      assertAppointmentSlotAvailability({
        professionalId: "pro-1",
        date: "2026-06-23",
        time: "09:30",
        durationMinutes: 60,
        prismaOrTx: tx,
      }),
    (error) => {
      assert.equal(error.message, "Este horário não está disponível para a duração deste serviço.");
      return true;
    },
  );
});

test("assertAppointmentSlotAvailability permite borda exata sem overlap", async () => {
  const { tx } = createTransactionHarness({
    appointmentConflict: null,
  });

  const result = await assertAppointmentSlotAvailability({
    professionalId: "pro-1",
    date: "2026-06-23",
    time: "10:00",
    durationMinutes: 60,
    prismaOrTx: tx,
  });

  assert.equal(result.startUtc.toISOString(), "2026-06-23T13:00:00.000Z");
  assert.equal(result.endUtc.toISOString(), "2026-06-23T14:00:00.000Z");
});

test("assertAppointmentSlotAvailability ignora o próprio agendamento no conflito", async () => {
  const { tx, state } = createTransactionHarness();

  await assertAppointmentSlotAvailability({
    appointmentIdToIgnore: "apt-1",
    professionalId: "pro-1",
    date: "2026-06-23",
    time: "09:00",
    durationMinutes: 60,
    prismaOrTx: tx,
  });

  assert.equal(state.appointmentFindFirstCalls[0].where.professionalId, "pro-1");
  assert.equal(state.appointmentFindFirstCalls[0].where.id.not, "apt-1");
  assert.equal(
    state.appointmentFindFirstCalls[0].where.startAt.lt.toISOString(),
    "2026-06-23T13:00:00.000Z",
  );
});

test("rescheduleAppointment mantém profissional atual quando payload não informa professionalId", async (t) => {
  const originalTransaction = prisma.$transaction;
  const calls = [];
  const { tx, state } = createTransactionHarness();

  t.after(() => {
    prisma.$transaction = originalTransaction;
  });

  prisma.$transaction = async (callback, options) => {
    calls.push(options);
    return callback(tx);
  };

  const result = await rescheduleAppointment(
    "apt-1",
    { date: "2026-06-23", time: "22:30" },
    buildActor(),
    { skipSideEffects: true },
  );

  assert.equal(calls[0].isolationLevel, "Serializable");
  assert.equal(state.appointmentUpdateCalls.length, 1);
  assert.equal(state.appointmentUpdateCalls[0].data.professionalId, "pro-1");
  assert.equal(state.appointmentUpdateCalls[0].data.startAt.toISOString(), "2026-06-24T01:30:00.000Z");
  assert.equal(state.appointmentUpdateCalls[0].data.endAt.toISOString(), "2026-06-24T02:30:00.000Z");
  assert.equal(result.client.id, "client-1");
  assert.equal(result.service.id, "service-1");
  assert.equal(result.status, APPOINTMENT_STATUS.SCHEDULED);
});

test("rescheduleAppointment muda o profissional quando professionalId válido é informado", async (t) => {
  const originalTransaction = prisma.$transaction;
  const { tx, state } = createTransactionHarness({
    updatedProfessionalId: "pro-2",
  });

  t.after(() => {
    prisma.$transaction = originalTransaction;
  });

  prisma.$transaction = async (callback) => callback(tx);

  const result = await rescheduleAppointment(
    "apt-1",
    { date: "2026-06-23", time: "10:00", professionalId: "pro-2" },
    buildActor(),
    { skipSideEffects: true },
  );

  assert.equal(state.appointmentUpdateCalls[0].data.professionalId, "pro-2");
  assert.equal(result.professional.id, "pro-2");
});

test("rescheduleAppointment não permite reagendar no-show", async (t) => {
  const originalTransaction = prisma.$transaction;
  const { tx } = createTransactionHarness({
    currentAppointment: buildRescheduleAppointment({
      status: APPOINTMENT_STATUS.NO_SHOW,
    }),
  });

  t.after(() => {
    prisma.$transaction = originalTransaction;
  });

  prisma.$transaction = async (callback) => callback(tx);

  await assert.rejects(
    () =>
      rescheduleAppointment(
        "apt-1",
        { date: "2026-06-23", time: "10:00" },
        buildActor(),
        { skipSideEffects: true },
      ),
    (error) => {
      assert.equal(error.message, "Não é possível reagendar este agendamento.");
      return true;
    },
  );
});

test("rescheduleAppointment não permite reagendar cancelado", async (t) => {
  const originalTransaction = prisma.$transaction;
  const { tx } = createTransactionHarness({
    currentAppointment: buildRescheduleAppointment({
      status: APPOINTMENT_STATUS.CANCELED,
    }),
  });

  t.after(() => {
    prisma.$transaction = originalTransaction;
  });

  prisma.$transaction = async (callback) => callback(tx);

  await assert.rejects(
    () =>
      rescheduleAppointment(
        "apt-1",
        { date: "2026-06-23", time: "10:00" },
        buildActor(),
        { skipSideEffects: true },
      ),
    (error) => {
      assert.equal(error.message, "Não é possível reagendar este agendamento.");
      return true;
    },
  );
});

test("rescheduleAppointment não permite reagendar finalizado", async (t) => {
  const originalTransaction = prisma.$transaction;
  const { tx } = createTransactionHarness({
    currentAppointment: buildRescheduleAppointment({
      status: APPOINTMENT_STATUS.FINISHED,
    }),
  });

  t.after(() => {
    prisma.$transaction = originalTransaction;
  });

  prisma.$transaction = async (callback) => callback(tx);

  await assert.rejects(
    () =>
      rescheduleAppointment(
        "apt-1",
        { date: "2026-06-23", time: "10:00" },
        buildActor(),
        { skipSideEffects: true },
      ),
    (error) => {
      assert.equal(error.message, "Não é possível reagendar este agendamento.");
      return true;
    },
  );
});

test("rescheduleAppointment faz retry em conflito serializável de transação", async (t) => {
  const originalTransaction = prisma.$transaction;
  const { tx } = createTransactionHarness();
  let attempts = 0;

  t.after(() => {
    prisma.$transaction = originalTransaction;
  });

  prisma.$transaction = async (callback) => {
    attempts += 1;

    if (attempts === 1) {
      const error = new Error("serialization failure");
      error.code = "P2034";
      throw error;
    }

    return callback(tx);
  };

  const result = await rescheduleAppointment(
    "apt-1",
    { date: "2026-06-23", time: "10:00" },
    buildActor(),
    { skipSideEffects: true },
  );

  assert.equal(attempts, 2);
  assert.equal(result.startAt.toISOString(), "2026-06-23T13:00:00.000Z");
});

test("updateAppointment retorna NO_SHOW para SCHEDULED quando data/hora mudam", async (t) => {
  const state = stubUpdateAppointmentDependencies(t, {
    currentAppointment: buildEditableAppointment({
      status: APPOINTMENT_STATUS.NO_SHOW,
      startAt: new Date("2026-06-23T12:00:00.000Z"),
    }),
  });

  const result = await updateAppointment(
    "apt-edit-1",
    {
      clientId: "client-1",
      professionalId: "pro-1",
      serviceId: "service-1",
      startAt: new Date("2026-06-23T13:00:00.000Z"),
      status: APPOINTMENT_STATUS.NO_SHOW,
      notes: "Reagendado manualmente",
    },
    buildActor(),
    { skipSideEffects: true },
  );

  assert.equal(state.appointmentUpdateCalls[0].data.status, APPOINTMENT_STATUS.SCHEDULED);
  assert.equal(result.status, APPOINTMENT_STATUS.SCHEDULED);
});

test("updateAppointment mantém NO_SHOW quando horário não muda", async (t) => {
  const state = stubUpdateAppointmentDependencies(t, {
    currentAppointment: buildEditableAppointment({
      status: APPOINTMENT_STATUS.NO_SHOW,
      startAt: new Date("2026-06-23T12:00:00.000Z"),
    }),
  });

  const result = await updateAppointment(
    "apt-edit-1",
    {
      clientId: "client-1",
      professionalId: "pro-1",
      serviceId: "service-1",
      startAt: new Date("2026-06-23T12:00:00.000Z"),
      status: APPOINTMENT_STATUS.NO_SHOW,
      notes: "Apenas observacao",
    },
    buildActor(),
    { skipSideEffects: true },
  );

  assert.equal(state.appointmentUpdateCalls[0].data.status, APPOINTMENT_STATUS.NO_SHOW);
  assert.equal(result.status, APPOINTMENT_STATUS.NO_SHOW);
});

test("updateAppointmentStatus cancela sem remover o registro", async (t) => {
  const state = stubUpdateAppointmentDependencies(t, {
    currentAppointment: buildEditableAppointment({
      status: APPOINTMENT_STATUS.SCHEDULED,
    }),
  });

  const result = await updateAppointmentStatus(
    "apt-edit-1",
    { status: APPOINTMENT_STATUS.CANCELED },
    buildActor(),
    { skipSideEffects: true },
  );

  assert.equal(state.appointmentUpdateCalls.length, 1);
  assert.deepEqual(state.appointmentUpdateCalls[0].data, {
    status: APPOINTMENT_STATUS.CANCELED,
  });
  assert.equal("deletedAt" in state.appointmentUpdateCalls[0].data, false);
  assert.equal(result.status, APPOINTMENT_STATUS.CANCELED);
});

test("getUpcomingAppointmentAlerts usa janela padrão de 30 minutos e calcula minutesUntil", async (t) => {
  const originalFindMany = prisma.appointment.findMany;
  const calls = [];

  t.after(() => {
    prisma.appointment.findMany = originalFindMany;
  });

  prisma.appointment.findMany = async (args) => {
    calls.push(args);
    return [
      {
        id: "apt-1",
        startAt: new Date("2026-06-23T12:12:00.000Z"),
        status: APPOINTMENT_STATUS.SCHEDULED,
        client: { id: "client-1", name: "João" },
        professional: { id: "pro-1", name: "Carlos" },
        service: { id: "service-1", name: "Corte" },
      },
    ];
  };

  const result = await getUpcomingAppointmentAlerts(
    { windowMinutes: 30 },
    buildActor(),
    { now: new Date("2026-06-23T12:00:00.000Z") },
  );

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].where.status.in, [
    APPOINTMENT_STATUS.SCHEDULED,
    APPOINTMENT_STATUS.CONFIRMED,
  ]);
  assert.equal(result.meta.windowMinutes, 30);
  assert.equal(result.items.length, 1);
  assert.deepEqual(result.items[0], {
    id: "apt-1",
    date: "2026-06-23",
    time: "09:12",
    clientName: "João",
    professionalName: "Carlos",
    serviceName: "Corte",
    status: APPOINTMENT_STATUS.SCHEDULED,
    minutesUntil: 12,
  });
});

test("getUpcomingAppointmentAlerts limita a busca ao fim do dia comercial", async (t) => {
  const originalFindMany = prisma.appointment.findMany;
  const calls = [];

  t.after(() => {
    prisma.appointment.findMany = originalFindMany;
  });

  prisma.appointment.findMany = async (args) => {
    calls.push(args);
    return [];
  };

  await getUpcomingAppointmentAlerts(
    { windowMinutes: 30 },
    buildActor(),
    { now: new Date("2026-06-24T02:50:00.000Z") },
  );

  assert.equal(
    calls[0].where.startAt.lte.toISOString(),
    "2026-06-24T02:59:59.999Z",
  );
});

test("getUpcomingAppointmentAlerts para PROFESSIONAL filtra apenas o próprio profissional", async (t) => {
  const originalFindMany = prisma.appointment.findMany;
  const originalProfessionalFindFirst = prisma.professional.findFirst;
  const calls = [];

  t.after(() => {
    prisma.appointment.findMany = originalFindMany;
    prisma.professional.findFirst = originalProfessionalFindFirst;
  });

  prisma.professional.findFirst = async () => ({
    id: "pro-77",
    userId: "user-pro-77",
    name: "Carlos",
    status: "ACTIVE",
  });
  prisma.appointment.findMany = async (args) => {
    calls.push(args);
    return [];
  };

  const result = await getUpcomingAppointmentAlerts(
    { windowMinutes: 30 },
    buildActor("PROFESSIONAL", "user-pro-77"),
    { now: new Date("2026-06-23T12:00:00.000Z") },
  );

  assert.equal(calls[0].where.professionalId, "pro-77");
  assert.deepEqual(result.items, []);
});

// ── createAppointment — duplicate detection ──────────────────────────────────

function buildDuplicateHarness(t, options = {}) {
  const existing = options.existingAppointment ?? {
    id: "apt-existing",
    clientId: "client-1",
    serviceId: "svc-1",
    professionalId: "pro-1",
    startAt: new Date("2026-06-25T13:00:00.000Z"), // 10:00 America/Sao_Paulo
    endAt: new Date("2026-06-25T14:00:00.000Z"),
    status: "SCHEDULED",
    client: { id: "client-1", name: "João" },
    professional: { id: "pro-1", name: "Alpha" },
    service: { id: "svc-1", name: "Corte" },
  };

  const saved = {
    clientFindFirst: prisma.client.findFirst,
    professionalFindFirst: prisma.professional.findFirst,
    serviceFindFirst: prisma.service.findFirst,
    appointmentFindFirst: prisma.appointment.findFirst,
    scheduleBlockFindFirst: prisma.scheduleBlock?.findFirst,
  };

  t.after(() => {
    prisma.client.findFirst = saved.clientFindFirst;
    prisma.professional.findFirst = saved.professionalFindFirst;
    prisma.service.findFirst = saved.serviceFindFirst;
    prisma.appointment.findFirst = saved.appointmentFindFirst;
    if (saved.scheduleBlockFindFirst !== undefined) {
      prisma.scheduleBlock.findFirst = saved.scheduleBlockFindFirst;
    }
  });

  prisma.client.findFirst = async () => ({
    id: "client-1",
    name: "João",
    status: "ACTIVE",
    userId: "u-client-1",
  });
  prisma.professional.findFirst = async () => ({
    id: "pro-1",
    name: "Alpha",
    status: "ACTIVE",
    appointmentIntervalMinutes: 30,
    userId: "u-pro-1",
  });
  prisma.service.findFirst = async () => ({
    id: "svc-1",
    name: "Corte",
    status: "ACTIVE",
    durationMinutes: 60,
    price: 5000,
  });
  prisma.appointment.findFirst = async () =>
    options.appointmentFindFirst === undefined ? existing : options.appointmentFindFirst;

  return { existing };
}

const ADMIN_ACTOR = buildActor();
const BASE_PAYLOAD = {
  clientId: "client-1",
  professionalId: "pro-1",
  serviceId: "svc-1",
  startAt: new Date("2026-06-26T13:00:00.000Z"),
};

test("createAppointment lança ConflictError quando cliente já tem agendamento ativo para o mesmo serviço", async (t) => {
  buildDuplicateHarness(t);

  await assert.rejects(
    () => createAppointment(BASE_PAYLOAD, ADMIN_ACTOR),
    (error) => {
      assert.equal(error instanceof ConflictError, true);
      assert.equal(error.code, "APPOINTMENT_DUPLICATE_CLIENT_SERVICE");
      return true;
    },
  );
});

test("createAppointment: existingAppointment na resposta 409 mantém somente o contrato mínimo", async (t) => {
  buildDuplicateHarness(t);

  await assert.rejects(
    () => createAppointment(BASE_PAYLOAD, ADMIN_ACTOR),
    (error) => {
      const ea = error.meta?.existingAppointment;
      assert.deepEqual(Object.keys(ea).sort(), [
        "client",
        "clientId",
        "endAt",
        "id",
        "professional",
        "professionalId",
        "service",
        "serviceId",
        "startAt",
        "status",
      ]);
      assert.equal(ea.startAt instanceof Date, true);
      assert.equal(ea.endAt instanceof Date, true);
      return true;
    },
  );
});

test("createAppointment: existingAppointment na resposta 409 inclui client, professional e service", async (t) => {
  buildDuplicateHarness(t);

  await assert.rejects(
    () => createAppointment(BASE_PAYLOAD, ADMIN_ACTOR),
    (error) => {
      const ea = error.meta?.existingAppointment;
      assert.equal(ea.client.name, "João");
      assert.equal(ea.professional.name, "Alpha");
      assert.equal(ea.service.name, "Corte");
      assert.equal(ea.status, "SCHEDULED");
      return true;
    },
  );
});

test("createAppointment: confirmDuplicate=true bypassa a verificação e prossegue para os próximos passos", async (t) => {
  buildDuplicateHarness(t);

  const sentinel = Object.assign(new Error("SENTINEL_SCHEDULE_BLOCK"), { isSentinel: true });
  prisma.scheduleBlock.findFirst = async () => { throw sentinel; };

  await assert.rejects(
    () => createAppointment({ ...BASE_PAYLOAD, confirmDuplicate: true }, ADMIN_ACTOR),
    (error) => {
      assert.equal(error.isSentinel, true, "deve chegar ao passo de scheduleBlock, não ao ConflictError de duplicidade");
      return true;
    },
  );
});
