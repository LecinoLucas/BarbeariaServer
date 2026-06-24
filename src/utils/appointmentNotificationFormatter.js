import { AGENDA_TIME_ZONE } from "./agendaTimezone.js";

function formatBusinessDate(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: AGENDA_TIME_ZONE,
  }).format(new Date(value));
}

function formatBusinessTime(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: AGENDA_TIME_ZONE,
  }).format(new Date(value));
}

function extractAppointmentContext(appointment) {
  return {
    appointmentId: appointment?.id ?? null,
    clientId: appointment?.client?.id ?? appointment?.clientId ?? null,
    clientName: appointment?.client?.name ?? null,
    professionalId: appointment?.professional?.id ?? appointment?.professionalId ?? null,
    professionalName: appointment?.professional?.name ?? null,
    serviceId: appointment?.service?.id ?? appointment?.serviceId ?? null,
    serviceName: appointment?.service?.name ?? null,
    startAt: appointment?.startAt ?? null,
    status: appointment?.status ?? null,
    date: appointment?.startAt ? formatBusinessDate(appointment.startAt) : null,
    time: appointment?.startAt ? formatBusinessTime(appointment.startAt) : null,
  };
}

function buildAppointmentLabelParts(appointment) {
  const context = extractAppointmentContext(appointment);
  const service = context.serviceName || "serviço";
  const professional = context.professionalName || "profissional";
  const client = context.clientName || "Cliente";
  const dateAndTime =
    context.date && context.time ? `${context.date} às ${context.time}` : context.time || context.date || "";

  return {
    ...context,
    client,
    service,
    professional,
    dateAndTime,
  };
}

export function buildAppointmentNotificationMetadata(appointment, extra = {}) {
  const context = extractAppointmentContext(appointment);

  return {
    appointmentId: context.appointmentId,
    clientId: context.clientId,
    clientName: context.clientName,
    professionalId: context.professionalId,
    professionalName: context.professionalName,
    serviceId: context.serviceId,
    serviceName: context.serviceName,
    startAt: context.startAt,
    status: context.status,
    date: context.date,
    time: context.time,
    ...extra,
  };
}

export function buildAppointmentCreatedMessage(appointment) {
  const { client, service, professional, dateAndTime } = buildAppointmentLabelParts(appointment);
  return `${client} agendou ${service} com ${professional}${dateAndTime ? ` para ${dateAndTime}` : ""}.`;
}

export function buildAppointmentCanceledMessage(actorName, appointment) {
  const { service, professional, dateAndTime } = buildAppointmentLabelParts(appointment);
  const actor = actorName || "O cliente";
  return `${actor} cancelou ${service} com ${professional}${dateAndTime ? ` de ${dateAndTime}` : ""}.`;
}

export function buildAppointmentRescheduledMessage(actorName, appointment) {
  const { service, professional, dateAndTime } = buildAppointmentLabelParts(appointment);
  const actor = actorName || "O cliente";
  return `${actor} reagendou ${service} com ${professional}${dateAndTime ? ` para ${dateAndTime}` : ""}.`;
}

export function buildAppointmentReminderMessage(appointment, minutes) {
  const { client, service, professional, time } = buildAppointmentLabelParts(appointment);
  return `${client} chega em ${minutes} min para ${service} com ${professional}${time ? `, às ${time}` : ""}.`;
}
