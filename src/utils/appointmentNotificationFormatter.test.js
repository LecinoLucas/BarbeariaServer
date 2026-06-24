import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAppointmentCanceledMessage,
  buildAppointmentCreatedMessage,
  buildAppointmentNotificationMetadata,
  buildAppointmentReminderMessage,
  buildAppointmentRescheduledMessage,
} from "./appointmentNotificationFormatter.js";

function buildAppointment(overrides = {}) {
  return {
    id: "appointment-1",
    clientId: "client-1",
    professionalId: "professional-1",
    serviceId: "service-1",
    startAt: new Date("2026-06-24T12:00:00.000Z"),
    status: "SCHEDULED",
    client: { id: "client-1", name: "Joao" },
    professional: { id: "professional-1", name: "Carlos" },
    service: { id: "service-1", name: "Corte" },
    ...overrides,
  };
}

test("buildAppointmentNotificationMetadata expõe contexto operacional local sem UTC visual", () => {
  const metadata = buildAppointmentNotificationMetadata(buildAppointment(), {
    minutes: 15,
  });

  assert.deepEqual(metadata, {
    appointmentId: "appointment-1",
    clientId: "client-1",
    clientName: "Joao",
    professionalId: "professional-1",
    professionalName: "Carlos",
    serviceId: "service-1",
    serviceName: "Corte",
    startAt: new Date("2026-06-24T12:00:00.000Z"),
    status: "SCHEDULED",
    date: "24/06",
    time: "09:00",
    minutes: 15,
  });
});

test("buildAppointmentCreatedMessage traz cliente, serviço, profissional e horário", () => {
  assert.equal(
    buildAppointmentCreatedMessage(buildAppointment()),
    "Joao agendou Corte com Carlos para 24/06 às 09:00.",
  );
});

test("buildAppointmentCanceledMessage traz contexto completo", () => {
  assert.equal(
    buildAppointmentCanceledMessage("Joao", buildAppointment()),
    "Joao cancelou Corte com Carlos de 24/06 às 09:00.",
  );
});

test("buildAppointmentRescheduledMessage traz novo horário local", () => {
  assert.equal(
    buildAppointmentRescheduledMessage("Joao", buildAppointment()),
    "Joao reagendou Corte com Carlos para 24/06 às 09:00.",
  );
});

test("buildAppointmentReminderMessage informa antecedência e contexto real", () => {
  assert.equal(
    buildAppointmentReminderMessage(buildAppointment(), 15),
    "Joao chega em 15 min para Corte com Carlos, às 09:00.",
  );
});
