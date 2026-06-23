import { APPOINTMENT_STATUS } from "../../constants/appointmentStatus.js";
import { ATTENDANCE_STATUS } from "../../constants/attendanceStatus.js";
import { PAYMENT_METHODS } from "../../constants/paymentMethods.js";
import { ROLES } from "../../constants/roles.js";
import { SERVICE_STATUS } from "../../constants/serviceStatus.js";
import { BadRequestError } from "../../errors/BadRequestError.js";
import { ConflictError } from "../../errors/ConflictError.js";
import { ForbiddenError } from "../../errors/ForbiddenError.js";
import { NotFoundError } from "../../errors/NotFoundError.js";
import { UnauthorizedError } from "../../errors/UnauthorizedError.js";
import { emitToAdmins } from "../../socket/socket.emitter.js";
import { SOCKET_EVENTS } from "../../socket/socket.events.js";
import { PAYMENT_STATUS } from "../../constants/paymentStatus.js";
import { findByAttendanceId as findPaymentByAttendanceId } from "../payments/payment.repository.js";
import {
  findByCode as findPaymentMethodByCode,
  findById as findPaymentMethodById,
} from "../paymentMethods/paymentMethod.repository.js";
import {
  cancelAttendance as repoCancelAttendance,
  countAttendances,
  createAttendance,
  createAttendanceItem,
  deleteAttendanceItem,
  findAppointmentById,
  findAttendanceById,
  findAttendanceItemById,
  findOpenAttendanceByAppointmentId,
  findProfessionalByUserId,
  findServiceById,
  finishAttendance as repoFinishAttendance,
  finishAttendanceWithPayment as repoFinishAttendanceWithPayment,
  listAttendanceItems,
  listAttendances,
} from "./attendance.repository.js";
import { withAttendanceTotal, withAttendanceTotals } from "./attendance.utils.js";

const NOT_FOUND_ATTENDANCE = "Atendimento não encontrado.";
const NOT_FOUND_APPOINTMENT = "Agendamento não encontrado.";
const NOT_FOUND_ITEM = "Item não encontrado.";
const ACCESS_DENIED = "Acesso negado.";
const ATTENDANCE_NOT_OPEN = "Atendimento não está aberto.";
const legacyPaymentMethodValues = new Set(Object.values(PAYMENT_METHODS));

function toPaymentEventPayload(payment) {
  return {
    id: payment.id,
    attendanceId: payment.attendanceId,
    amount: Number(payment.amount),
    discount: Number(payment.discount),
    total: Number(payment.total),
    status: payment.status,
    paymentMethod: payment.paymentMethod,
    paidAt: payment.paidAt,
  };
}

async function resolveOwnProfessional(userId) {
  return findProfessionalByUserId(userId);
}

async function ensureAttendanceAccess(actor, attendance) {
  if (actor.role === ROLES.ADMIN) return;

  if (actor.role === ROLES.PROFESSIONAL) {
    const own = await resolveOwnProfessional(actor.id);
    if (!own || own.id !== attendance.professionalId) {
      throw new ForbiddenError(ACCESS_DENIED);
    }
    return;
  }

  throw new ForbiddenError(ACCESS_DENIED);
}

async function ensureAttendanceOpen(attendance) {
  if (attendance.status !== ATTENDANCE_STATUS.OPEN) {
    throw new BadRequestError(ATTENDANCE_NOT_OPEN);
  }
}

async function ensureNoExistingPaymentForFinish(attendanceId, paymentAction) {
  if (paymentAction !== "PAID" && paymentAction !== "PENDING") {
    return;
  }

  const existingPayment = await findPaymentByAttendanceId(attendanceId);

  if (existingPayment) {
    throw new ConflictError("Já existe um pagamento para este atendimento.");
  }
}

async function resolveFinishPaymentPayload(payload) {
  if (payload.paymentAction !== "PAID" && payload.paymentAction !== "PENDING") {
    return payload;
  }

  if (payload.paymentMethodId) {
    const config = await findPaymentMethodById(payload.paymentMethodId);

    if (!config) {
      throw new BadRequestError("Forma de pagamento não encontrada.");
    }

    if (!config.isActive) {
      throw new BadRequestError("Forma de pagamento inativa.");
    }

    return {
      ...payload,
      paymentMethodId: config.id,
      paymentMethod:
        payload.paymentMethod ??
        (legacyPaymentMethodValues.has(config.code) ? config.code : PAYMENT_METHODS.OTHER),
    };
  }

  if (payload.paymentMethod) {
    const config = await findPaymentMethodByCode(payload.paymentMethod);

    return {
      ...payload,
      paymentMethodId: config?.id ?? null,
    };
  }

  return payload;
}

export async function startAttendance(payload, actor) {
  const appointment = await findAppointmentById(payload.appointmentId);

  if (!appointment) throw new NotFoundError(NOT_FOUND_APPOINTMENT);

  const startableStatuses = [APPOINTMENT_STATUS.SCHEDULED, APPOINTMENT_STATUS.CONFIRMED];

  if (!startableStatuses.includes(appointment.status)) {
    throw new BadRequestError("Agendamento não está disponível para atendimento.");
  }

  const existing = await findOpenAttendanceByAppointmentId(payload.appointmentId);

  if (existing) {
    throw new ConflictError("Já existe um atendimento em aberto para este agendamento.");
  }

  if (actor.role === ROLES.PROFESSIONAL) {
    const own = await resolveOwnProfessional(actor.id);
    if (!own || own.id !== appointment.professionalId) {
      throw new ForbiddenError(ACCESS_DENIED);
    }
  }

  return createAttendance({
    appointmentId: appointment.id,
    clientId: appointment.clientId,
    professionalId: appointment.professionalId,
  });
}

export async function getAttendances(query, actor) {
  const filters = { ...query };

  if (actor.role === ROLES.PROFESSIONAL) {
    const own = await resolveOwnProfessional(actor.id);
    filters.professionalId = own?.id ?? "none";
  }

  const [items, total] = await Promise.all([
    listAttendances(filters),
    countAttendances(filters),
  ]);

  return {
    items: withAttendanceTotals(items),
    meta: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / filters.limit),
    },
  };
}

export async function getAttendanceById(id, actor) {
  const attendance = await findAttendanceById(id);

  if (!attendance) throw new NotFoundError(NOT_FOUND_ATTENDANCE);

  await ensureAttendanceAccess(actor, attendance);

  return withAttendanceTotal(attendance);
}

export async function addItem(attendanceId, payload, actor) {
  const attendance = await findAttendanceById(attendanceId);

  if (!attendance) throw new NotFoundError(NOT_FOUND_ATTENDANCE);

  await ensureAttendanceAccess(actor, attendance);
  await ensureAttendanceOpen(attendance);

  const service = await findServiceById(payload.serviceId);

  if (!service || service.status !== SERVICE_STATUS.ACTIVE) {
    throw new BadRequestError("Serviço não encontrado ou inativo.");
  }

  const unitPrice = Number(service.price);
  const total = parseFloat((payload.quantity * unitPrice).toFixed(2));

  return createAttendanceItem({
    attendanceId,
    serviceId: service.id,
    description: service.name,
    quantity: payload.quantity,
    unitPrice,
    total,
  });
}

export async function getItems(attendanceId, actor) {
  const attendance = await findAttendanceById(attendanceId);

  if (!attendance) throw new NotFoundError(NOT_FOUND_ATTENDANCE);

  await ensureAttendanceAccess(actor, attendance);

  return listAttendanceItems(attendanceId);
}

export async function removeItem(attendanceId, itemId, actor) {
  const attendance = await findAttendanceById(attendanceId);

  if (!attendance) throw new NotFoundError(NOT_FOUND_ATTENDANCE);

  await ensureAttendanceAccess(actor, attendance);
  await ensureAttendanceOpen(attendance);

  const item = await findAttendanceItemById(itemId);

  if (!item || item.attendanceId !== attendanceId) {
    throw new NotFoundError(NOT_FOUND_ITEM);
  }

  await deleteAttendanceItem(itemId);
}

export async function finishAttendance(id, actor) {
  const attendance = await findAttendanceById(id);

  if (!attendance) throw new NotFoundError(NOT_FOUND_ATTENDANCE);

  await ensureAttendanceAccess(actor, attendance);
  await ensureAttendanceOpen(attendance);

  return repoFinishAttendance(id, attendance.appointmentId);
}

export async function finishAttendanceWithPayment(id, payload, actor) {
  const attendance = await findAttendanceById(id);

  if (!attendance) throw new NotFoundError(NOT_FOUND_ATTENDANCE);

  await ensureAttendanceAccess(actor, attendance);
  await ensureNoExistingPaymentForFinish(id, payload.paymentAction);
  await ensureAttendanceOpen(attendance);

  const normalizedPayload = await resolveFinishPaymentPayload(payload);
  const result = await repoFinishAttendanceWithPayment(
    id,
    attendance.appointmentId,
    normalizedPayload,
  );
  const normalizedAttendance = withAttendanceTotal(result.attendance);

  if (result.payment) {
    emitToAdmins(SOCKET_EVENTS.PAYMENT_CREATED, toPaymentEventPayload(result.payment));

    if (result.payment.status === PAYMENT_STATUS.PAID) {
      emitToAdmins(SOCKET_EVENTS.PAYMENT_PAID, toPaymentEventPayload(result.payment));
    }
  }

  return {
    attendance: normalizedAttendance,
    payment: result.payment ?? null,
  };
}

export async function cancelAttendance(id) {
  const attendance = await findAttendanceById(id);

  if (!attendance) throw new NotFoundError(NOT_FOUND_ATTENDANCE);

  await ensureAttendanceOpen(attendance);

  await repoCancelAttendance(id, attendance.appointmentId);
}
