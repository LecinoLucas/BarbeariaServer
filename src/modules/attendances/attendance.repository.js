import prisma from "../../database/prisma.js";
import { ConflictError } from "../../errors/ConflictError.js";
import { calculateAttendanceTotal } from "./attendance.utils.js";

const paymentSelect = {
  id: true,
  attendanceId: true,
  amount: true,
  discount: true,
  total: true,
  paymentMethod: true,
  paymentMethodId: true,
  paymentMethodConfig: {
    select: {
      id: true,
      code: true,
      name: true,
      isActive: true,
    },
  },
  status: true,
  paidAt: true,
  createdAt: true,
  updatedAt: true,
};

const attendanceListSelect = {
  id: true,
  appointmentId: true,
  clientId: true,
  professionalId: true,
  startedAt: true,
  finishedAt: true,
  status: true,
  createdAt: true,
  notes: true,
  appointment: {
    select: {
      id: true,
      startAt: true,
      endAt: true,
      status: true,
      service: {
        select: { id: true, name: true, price: true, durationMinutes: true },
      },
    },
  },
  client: { select: { id: true, name: true, phone: true } },
  professional: { select: { id: true, name: true } },
  items: {
    select: {
      id: true,
      description: true,
      quantity: true,
      unitPrice: true,
      total: true,
    },
    orderBy: { createdAt: "asc" },
  },
  payment: {
    select: paymentSelect,
  },
};

const attendanceDetailSelect = {
  id: true,
  appointmentId: true,
  clientId: true,
  professionalId: true,
  startedAt: true,
  finishedAt: true,
  status: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  appointment: {
    select: {
      id: true,
      startAt: true,
      endAt: true,
      status: true,
      notes: true,
      service: {
        select: { id: true, name: true, price: true, durationMinutes: true },
      },
    },
  },
  client: { select: { id: true, name: true, phone: true } },
  professional: { select: { id: true, name: true, specialty: true } },
  items: {
    select: {
      id: true,
      serviceId: true,
      description: true,
      quantity: true,
      unitPrice: true,
      total: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  },
  payment: {
    select: paymentSelect,
  },
};

const itemSelect = {
  id: true,
  attendanceId: true,
  serviceId: true,
  description: true,
  quantity: true,
  unitPrice: true,
  total: true,
  createdAt: true,
  updatedAt: true,
};

function buildWhere(filters) {
  const where = {};

  if (filters.status) where.status = filters.status;
  if (filters.clientId) where.clientId = filters.clientId;
  if (filters.professionalId) where.professionalId = filters.professionalId;
  if (filters.appointmentId) where.appointmentId = filters.appointmentId;

  if (filters.startDate || filters.endDate) {
    where.startedAt = {};
    if (filters.startDate) where.startedAt.gte = new Date(`${filters.startDate}T00:00:00.000Z`);
    if (filters.endDate) where.startedAt.lte = new Date(`${filters.endDate}T23:59:59.999Z`);
  }

  if (filters.search) {
    const s = filters.search;
    where.OR = [
      { client: { name: { contains: s, mode: "insensitive" } } },
      { client: { phone: { contains: s } } },
      { professional: { name: { contains: s, mode: "insensitive" } } },
      { appointment: { service: { name: { contains: s, mode: "insensitive" } } } },
    ];
  }

  return where;
}

export function findAppointmentById(id) {
  if (!id) return null;
  return prisma.appointment.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      clientId: true,
      professionalId: true,
      serviceId: true,
      status: true,
    },
  });
}

export function findAttendanceById(id) {
  if (!id) return null;
  return prisma.attendance.findFirst({
    where: { id },
    select: attendanceDetailSelect,
  });
}

export function findOpenAttendanceByAppointmentId(appointmentId) {
  return prisma.attendance.findFirst({
    where: { appointmentId, status: "OPEN" },
    select: { id: true },
  });
}

export function findAttendanceItemById(id) {
  if (!id) return null;
  return prisma.attendanceItem.findFirst({
    where: { id },
    select: itemSelect,
  });
}

export function findServiceById(id) {
  if (!id) return null;
  return prisma.service.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, name: true, price: true, status: true },
  });
}

export function findProfessionalByUserId(userId) {
  if (!userId) return null;
  return prisma.professional.findFirst({
    where: { userId, deletedAt: null },
    select: { id: true, userId: true },
  });
}

export function listAttendances(filters) {
  return prisma.attendance.findMany({
    where: buildWhere(filters),
    orderBy: { startedAt: "desc" },
    skip: (filters.page - 1) * filters.limit,
    take: filters.limit,
    select: attendanceListSelect,
  });
}

export function countAttendances(filters) {
  return prisma.attendance.count({ where: buildWhere(filters) });
}

export function listAttendanceItems(attendanceId) {
  return prisma.attendanceItem.findMany({
    where: { attendanceId },
    select: itemSelect,
    orderBy: { createdAt: "asc" },
  });
}

export function createAttendanceItem(data) {
  return prisma.attendanceItem.create({ data, select: itemSelect });
}

export function deleteAttendanceItem(id) {
  return prisma.attendanceItem.delete({ where: { id } });
}

export async function createAttendance({ appointmentId, clientId, professionalId }) {
  return prisma.$transaction(async (tx) => {
    const attendance = await tx.attendance.create({
      data: {
        appointmentId,
        clientId,
        professionalId,
        startedAt: new Date(),
        status: "OPEN",
      },
      select: { id: true, status: true, startedAt: true, appointmentId: true },
    });

    await tx.appointment.update({
      where: { id: appointmentId },
      data: { status: "IN_ATTENDANCE" },
    });

    return attendance;
  });
}

export async function finishAttendance(attendanceId, appointmentId) {
  return prisma.$transaction(async (tx) => {
    const attendance = await tx.attendance.findFirst({
      where: { id: attendanceId },
      select: attendanceDetailSelect,
    });

    const totalAmount = calculateAttendanceTotal(attendance);

    await tx.attendance.update({
      where: { id: attendanceId },
      data: { status: "FINISHED", finishedAt: new Date() },
    });

    await tx.appointment.update({
      where: { id: appointmentId },
      data: { status: "FINISHED" },
    });

    return { totalAmount };
  });
}

export async function finishAttendanceWithPayment(attendanceId, appointmentId, payload) {
  return prisma.$transaction(async (tx) => {
    const attendance = await tx.attendance.findFirst({
      where: { id: attendanceId },
      select: attendanceDetailSelect,
    });

    const totalAmount = calculateAttendanceTotal(attendance);

    await tx.attendance.update({
      where: { id: attendanceId },
      data: { status: "FINISHED", finishedAt: new Date() },
    });

    await tx.appointment.update({
      where: { id: appointmentId },
      data: { status: "FINISHED" },
    });

    let payment = null;

    if (payload.paymentAction === "PAID" || payload.paymentAction === "PENDING") {
      const existingPayment = await tx.payment.findUnique({
        where: { attendanceId },
        select: paymentSelect,
      });

      if (existingPayment) {
        throw new ConflictError("Já existe um pagamento para este atendimento.");
      }

      payment = await tx.payment.create({
        data: {
          attendanceId,
          amount: totalAmount,
          discount: 0,
          total: totalAmount,
          paymentMethod: payload.paymentMethod ?? null,
          paymentMethodId: payload.paymentMethodId ?? null,
          status: payload.paymentAction,
          paidAt: payload.paymentAction === "PAID" ? new Date() : null,
        },
        select: paymentSelect,
      });
    }

    const updatedAttendance = await tx.attendance.findFirst({
      where: { id: attendanceId },
      select: attendanceDetailSelect,
    });

    return {
      attendance: updatedAttendance,
      payment,
    };
  });
}

export async function cancelAttendance(attendanceId, appointmentId) {
  return prisma.$transaction(async (tx) => {
    await tx.attendance.update({
      where: { id: attendanceId },
      data: { status: "CANCELED", finishedAt: new Date() },
    });

    await tx.appointment.update({
      where: { id: appointmentId },
      data: { status: "CANCELED" },
    });
  });
}
