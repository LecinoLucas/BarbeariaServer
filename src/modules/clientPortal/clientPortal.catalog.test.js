import assert from "node:assert/strict";
import test from "node:test";

import prisma from "../../database/prisma.js";
import { BadRequestError } from "../../errors/BadRequestError.js";
import { ValidationError } from "../../errors/ValidationError.js";
import {
  getClientPortalAvailability,
  listClientPortalProfessionals,
  listClientPortalServices,
} from "./clientPortal.service.js";
import { validateClientPortalAvailabilityQuery } from "./clientPortal.validator.js";

function stubClientProfile() {
  return { id: "client-1", userId: "user-1" };
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
