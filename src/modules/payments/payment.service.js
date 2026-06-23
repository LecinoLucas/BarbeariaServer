import { ATTENDANCE_STATUS } from "../../constants/attendanceStatus.js";
import { PAYMENT_METHODS } from "../../constants/paymentMethods.js";
import { PAYMENT_STATUS } from "../../constants/paymentStatus.js";
import { ROLES } from "../../constants/roles.js";
import { emitToAdmins } from "../../socket/socket.emitter.js";
import { SOCKET_EVENTS } from "../../socket/socket.events.js";
import { BadRequestError } from "../../errors/BadRequestError.js";
import { ConflictError } from "../../errors/ConflictError.js";
import { ForbiddenError } from "../../errors/ForbiddenError.js";
import { NotFoundError } from "../../errors/NotFoundError.js";
import { UnauthorizedError } from "../../errors/UnauthorizedError.js";
import { calculateAttendanceTotals, withAttendanceTotal } from "../attendances/attendance.utils.js";
import {
  cancel,
  count,
  create,
  findAttendanceForPayment,
  findByAttendanceId,
  findById,
  findProfessionalByUserId,
  getFinancialSummary,
  list,
  pay,
  update,
} from "./payment.repository.js";
import {
  findByCode as findPaymentMethodByCode,
  findById as findPaymentMethodById,
} from "../paymentMethods/paymentMethod.repository.js";

const NOT_FOUND_MESSAGE = "Pagamento não encontrado.";
const ACCESS_DENIED_MESSAGE = "Acesso negado.";
const legacyPaymentMethodValues = new Set(Object.values(PAYMENT_METHODS));

function enrichPayment(payment) {
  if (!payment?.attendance) {
    return payment;
  }

  return {
    ...payment,
    attendance: withAttendanceTotal(payment.attendance),
  };
}

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

async function ensurePaymentAccess(actor, payment) {
  if (actor.role === ROLES.ADMIN) return;

  if (actor.role === ROLES.PROFESSIONAL) {
    const own = await findProfessionalByUserId(actor.id);
    const professionalId = payment.attendance?.professional?.id ?? null;

    if (!own || own.id !== professionalId) {
      throw new ForbiddenError(ACCESS_DENIED_MESSAGE);
    }

    return;
  }

  throw new ForbiddenError(ACCESS_DENIED_MESSAGE);
}

async function applyRoleFilters(filters, actor) {
  if (actor.role === ROLES.PROFESSIONAL) {
    const own = await findProfessionalByUserId(actor.id);
    return { ...filters, professionalId: own?.id ?? "none" };
  }

  return filters;
}

export async function createPayment(payload) {
  const attendance = await findAttendanceForPayment(payload.attendanceId);

  if (!attendance) {
    throw new NotFoundError("Atendimento não encontrado.");
  }

  if (attendance.status !== ATTENDANCE_STATUS.FINISHED) {
    throw new BadRequestError("Apenas atendimentos finalizados podem gerar pagamento.");
  }

  const existing = await findByAttendanceId(payload.attendanceId);

  if (existing) {
    throw new ConflictError("Já existe um pagamento para este atendimento.");
  }

  const amount = calculateAttendanceTotals(attendance).grandTotalCents / 100;

  const payment = await create({
    attendanceId: payload.attendanceId,
    amount,
    discount: 0,
    total: amount,
    status: PAYMENT_STATUS.PENDING,
    paidAt: null,
  });

  emitToAdmins(SOCKET_EVENTS.PAYMENT_CREATED, toPaymentEventPayload(payment));

  return enrichPayment(payment);
}

export async function listPayments(query, actor) {
  const filters = await applyRoleFilters(query, actor);
  const [items, total] = await Promise.all([list(filters), count(filters)]);

  return {
    items: items.map(enrichPayment),
    meta: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / filters.limit),
    },
  };
}

export async function getPaymentById(id, actor) {
  const payment = await findById(id);

  if (!payment) throw new NotFoundError(NOT_FOUND_MESSAGE);

  await ensurePaymentAccess(actor, payment);

  return enrichPayment(payment);
}

export async function updateDiscount(id, payload) {
  const payment = await findById(id);

  if (!payment) throw new NotFoundError(NOT_FOUND_MESSAGE);

  if (payment.status === PAYMENT_STATUS.PAID) {
    throw new BadRequestError("Não é possível aplicar desconto em um pagamento já pago.");
  }

  const discount = payload.discount;
  const amount = Number(payment.amount);

  if (discount > amount) {
    throw new BadRequestError("O desconto não pode ser maior que o valor total.");
  }

  const total = parseFloat((amount - discount).toFixed(2));

  return enrichPayment(await update(id, { discount, total }));
}

async function resolvePaymentMethodId(payload) {
  if (payload.paymentMethodId) {
    const config = await findPaymentMethodById(payload.paymentMethodId);
    if (!config) throw new BadRequestError("Forma de pagamento não encontrada.");
    if (!config.isActive) throw new BadRequestError("Forma de pagamento inativa.");
    return {
      paymentMethod:
        payload.paymentMethod ??
        (legacyPaymentMethodValues.has(config.code) ? config.code : PAYMENT_METHODS.OTHER),
      paymentMethodId: config.id,
    };
  }

  if (payload.paymentMethod) {
    const config = await findPaymentMethodByCode(payload.paymentMethod);
    return {
      paymentMethod: payload.paymentMethod,
      paymentMethodId: config?.id ?? null,
    };
  }

  return { paymentMethod: null, paymentMethodId: null };
}

export async function payPayment(id, payload, actor) {
  const payment = await findById(id);

  if (!payment) throw new NotFoundError(NOT_FOUND_MESSAGE);

  await ensurePaymentAccess(actor, payment);

  if (payment.status !== PAYMENT_STATUS.PENDING) {
    throw new BadRequestError("Apenas pagamentos pendentes podem ser recebidos.");
  }

  const { paymentMethod, paymentMethodId } = await resolvePaymentMethodId(payload);

  const paymentResult = await pay(id, paymentMethod, paymentMethodId);

  emitToAdmins(SOCKET_EVENTS.PAYMENT_PAID, toPaymentEventPayload(paymentResult));

  return enrichPayment(paymentResult);
}

export async function cancelPayment(id) {
  const payment = await findById(id);

  if (!payment) throw new NotFoundError(NOT_FOUND_MESSAGE);

  if (payment.status === PAYMENT_STATUS.PAID) {
    throw new BadRequestError("Não é possível cancelar um pagamento já pago.");
  }

  return enrichPayment(await cancel(id));
}

export async function getFinancialSummaryService(query) {
  return getFinancialSummary(query);
}
