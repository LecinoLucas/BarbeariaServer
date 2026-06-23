import { z } from "zod";

import { ValidationError } from "../../errors/ValidationError.js";
import { APPOINTMENT_STATUS } from "../../constants/appointmentStatus.js";
import { assertBusinessDate, assertBusinessTime } from "../../utils/agendaTimezone.js";

const statusValues = Object.values(APPOINTMENT_STATUS);
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const monthRegex = /^\d{4}-\d{2}$/;

const statusSchema = z.enum(statusValues, {
  errorMap: () => ({ message: "Status inválido." }),
});

function normalizeOptionalString(value) {
  if (value === "" || value === null || value === undefined) return undefined;
  return value;
}

const idSchema = (label) =>
  z.string({ required_error: `${label} é obrigatório.` }).min(1, `${label} inválido.`);

const startAtSchema = z
  .string({ required_error: "startAt é obrigatório." })
  .datetime("Data/hora inválida.")
  .transform((val) => new Date(val));

const notesSchema = z
  .preprocess(normalizeOptionalString, z.string().trim().optional())
  .transform((val) => val ?? null);

const optionalDateString = (label) =>
  z.string().regex(dateRegex, `${label} inválida.`).optional();

const businessDateSchema = z
  .string({ required_error: "date é obrigatório." })
  .superRefine((value, ctx) => {
    try {
      assertBusinessDate(value);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Data inválida.",
      });
    }
  });

const businessTimeSchema = z
  .string({ required_error: "time é obrigatório." })
  .superRefine((value, ctx) => {
    try {
      assertBusinessTime(value);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Horário inválido.",
      });
    }
  });

export const createAppointmentSchema = z.object({
  clientId: idSchema("clientId"),
  professionalId: idSchema("professionalId"),
  serviceId: idSchema("serviceId"),
  startAt: startAtSchema,
  notes: notesSchema,
  status: statusSchema.default(APPOINTMENT_STATUS.SCHEDULED),
  confirmDuplicate: z.boolean().optional().default(false),
});

export const updateAppointmentSchema = z.object({
  clientId: idSchema("clientId"),
  professionalId: idSchema("professionalId"),
  serviceId: idSchema("serviceId"),
  startAt: startAtSchema,
  notes: notesSchema,
  status: statusSchema,
});

export const updateAppointmentStatusSchema = z.object({
  status: statusSchema,
});

export const listAppointmentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(10),
  status: statusSchema.optional(),
  clientId: z.string().optional(),
  professionalId: z.string().optional(),
  serviceId: z.string().optional(),
  date: optionalDateString("Data"),
  startDate: optionalDateString("Data inicial"),
  endDate: optionalDateString("Data final"),
  search: z.string().trim().optional(),
});

export const availabilityQuerySchema = z.object({
  professionalId: idSchema("professionalId"),
  serviceId: idSchema("serviceId"),
  date: businessDateSchema,
});

export const rescheduleAppointmentSchema = z.object({
  date: businessDateSchema,
  time: businessTimeSchema,
  professionalId: z.preprocess(normalizeOptionalString, z.string().trim().min(1).optional()),
});

export const dayAppointmentsQuerySchema = z.object({
  date: z
    .string({ required_error: "date é obrigatório." })
    .regex(dateRegex, "Data inválida."),
  professionalId: z.string().optional(),
  status: statusSchema.optional(),
  search: z.string().trim().optional(),
});

export const weekAppointmentsQuerySchema = z.object({
  startDate: z
    .string({ required_error: "startDate é obrigatório." })
    .regex(dateRegex, "Data inicial inválida."),
  endDate: z
    .string({ required_error: "endDate é obrigatório." })
    .regex(dateRegex, "Data final inválida."),
  professionalId: z.string().optional(),
  status: statusSchema.optional(),
  search: z.string().trim().optional(),
}).refine((payload) => payload.endDate >= payload.startDate, {
  message: "Data final deve ser maior ou igual à data inicial.",
  path: ["endDate"],
});

export const monthSummaryAppointmentsQuerySchema = z.object({
  month: z
    .string({ required_error: "month é obrigatório." })
    .regex(monthRegex, "Mês inválido."),
  professionalId: z.string().optional(),
  status: statusSchema.optional(),
  search: z.string().trim().optional(),
}).refine((payload) => {
  const [, month] = payload.month.split("-").map(Number);
  return month >= 1 && month <= 12;
}, {
  message: "Mês inválido.",
  path: ["month"],
});

function parseOrThrow(schema, payload) {
  const result = schema.safeParse(payload);
  if (!result.success) throw new ValidationError(result.error);
  return result.data;
}

export function validateCreateAppointment(payload) {
  return parseOrThrow(createAppointmentSchema, payload);
}

export function validateUpdateAppointment(payload) {
  return parseOrThrow(updateAppointmentSchema, payload);
}

export function validateUpdateAppointmentStatus(payload) {
  return parseOrThrow(updateAppointmentStatusSchema, payload);
}

export function validateListAppointmentsQuery(payload) {
  return parseOrThrow(listAppointmentsQuerySchema, payload);
}

export function validateAvailabilityQuery(payload) {
  return parseOrThrow(availabilityQuerySchema, payload);
}

export function validateRescheduleAppointment(payload) {
  return parseOrThrow(rescheduleAppointmentSchema, payload);
}

export function validateDayAppointmentsQuery(payload) {
  return parseOrThrow(dayAppointmentsQuerySchema, payload);
}

export function validateWeekAppointmentsQuery(payload) {
  return parseOrThrow(weekAppointmentsQuerySchema, payload);
}

export function validateMonthSummaryAppointmentsQuery(payload) {
  return parseOrThrow(monthSummaryAppointmentsQuerySchema, payload);
}
