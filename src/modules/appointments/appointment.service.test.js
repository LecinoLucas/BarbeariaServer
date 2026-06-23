import assert from "node:assert/strict";
import test from "node:test";

import prisma from "../../database/prisma.js";
import { APPOINTMENT_STATUS } from "../../constants/appointmentStatus.js";
import { BadRequestError } from "../../errors/BadRequestError.js";
import { ConflictError } from "../../errors/ConflictError.js";
import {
  assertAppointmentSlotAvailability,
  buildCalendarDays,
  generateSlots,
  groupAppointmentsByBusinessDay,
  rescheduleAppointment,
  resolveAppointmentIntervalMinutes,
  summarizeAppointmentsByBusinessDay,
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
