import { z } from "zod";

import { APPOINTMENT_STATUS } from "../../constants/appointmentStatus.js";
import { ValidationError } from "../../errors/ValidationError.js";
import { assertBusinessTime } from "../../utils/agendaTimezone.js";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

function normalizeOptionalString(value) {
  if (value === "") {
    return undefined;
  }

  return value;
}

function isValidDateString(value) {
  if (!dateRegex.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const appointmentStatusSchema = z.enum(Object.values(APPOINTMENT_STATUS), {
  errorMap: () => ({ message: "Status inválido." }),
});

const nameSchema = z
  .string({ required_error: "Nome é obrigatório." })
  .trim()
  .min(1, "Nome é obrigatório.");

const phoneSchema = z
  .string({ required_error: "Telefone é obrigatório." })
  .trim()
  .min(1, "Telefone é obrigatório.");

const optionalEmailSchema = z.preprocess(
  normalizeOptionalString,
  z
    .union([z.string().trim().email("Email inválido."), z.null()])
    .optional(),
).transform((value) => {
  if (!value) {
    return null;
  }

  return value.toLowerCase();
});

const optionalNotesSchema = z.preprocess(
  normalizeOptionalString,
  z.union([z.string().trim(), z.null()]).optional(),
).transform((value) => value ?? null);

const optionalBirthDateSchema = z.preprocess(
  normalizeOptionalString,
  z.union([z.string(), z.null()]).optional(),
).superRefine((value, ctx) => {
  if (value === undefined || value === null) {
    return;
  }

  if (!isValidDateString(value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Data de nascimento inválida.",
    });
  }
}).transform((value) => {
  if (!value) {
    return null;
  }

  return new Date(`${value}T00:00:00.000Z`);
});

const listClientAppointmentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: appointmentStatusSchema.optional(),
  startDate: z
    .string()
    .regex(dateRegex, "Data inicial inválida.")
    .optional(),
  endDate: z
    .string()
    .regex(dateRegex, "Data final inválida.")
    .optional(),
});

const listClientAttendancesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  startDate: z
    .string()
    .regex(dateRegex, "Data inicial inválida.")
    .optional(),
  endDate: z
    .string()
    .regex(dateRegex, "Data final inválida.")
    .optional(),
});

const updateClientProfileSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
  email: optionalEmailSchema,
  birthDate: optionalBirthDateSchema,
  notes: optionalNotesSchema,
});

const rescheduleClientAppointmentSchema = z.object({
  startAt: z
    .string({ required_error: "startAt é obrigatório." })
    .datetime("Data/hora inválida.")
    .transform((value) => new Date(value)),
});

const clientPortalAvailabilityQuerySchema = z.object({
  professionalId: z
    .string({ required_error: "professionalId é obrigatório." })
    .trim()
    .min(1, "professionalId inválido."),
  serviceId: z
    .string({ required_error: "serviceId é obrigatório." })
    .trim()
    .min(1, "serviceId inválido."),
  date: z.string({ required_error: "date é obrigatório." }).superRefine((value, ctx) => {
    if (!isValidDateString(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Data inválida.",
      });
    }
  }),
});

const createClientPortalAppointmentSchema = z.object({
  professionalId: z
    .string({ required_error: "professionalId é obrigatório." })
    .trim()
    .min(1, "professionalId inválido."),
  serviceId: z
    .string({ required_error: "serviceId é obrigatório." })
    .trim()
    .min(1, "serviceId inválido."),
  date: z.string({ required_error: "date é obrigatório." }).superRefine((value, ctx) => {
    if (!isValidDateString(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Data inválida.",
      });
    }
  }),
  time: z.string({ required_error: "time é obrigatório." }).superRefine((value, ctx) => {
    try {
      assertBusinessTime(value);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Horário inválido.",
      });
    }
  }),
  notes: optionalNotesSchema,
});

function parseOrThrow(schema, payload) {
  const result = schema.safeParse(payload);

  if (!result.success) {
    throw new ValidationError(result.error);
  }

  return result.data;
}

export function validateListClientAppointmentsQuery(payload) {
  return parseOrThrow(listClientAppointmentsQuerySchema, payload);
}

export function validateListClientAttendancesQuery(payload) {
  return parseOrThrow(listClientAttendancesQuerySchema, payload);
}

export function validateUpdateClientProfile(payload) {
  return parseOrThrow(updateClientProfileSchema, payload);
}

export function validateRescheduleClientAppointment(payload) {
  return parseOrThrow(rescheduleClientAppointmentSchema, payload);
}

export function validateClientPortalAvailabilityQuery(payload) {
  return parseOrThrow(clientPortalAvailabilityQuerySchema, payload);
}

export function validateCreateClientPortalAppointment(payload) {
  return parseOrThrow(createClientPortalAppointmentSchema, payload);
}
