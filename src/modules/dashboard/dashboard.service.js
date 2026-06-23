import {
  getBirthdays,
  getBusyHours,
  getExecutiveStats,
  getMonthStats,
  getMonthComparison,
  getNextAppointment,
  getStatusDistribution,
  getTodayStats,
  getTopClients,
  getTopProfessionals,
  getTopServices,
  getUpcomingAppointments,
} from "./dashboard.repository.js";

function getDateRanges(now) {
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  return {
    startOfDay,
    endOfDay,
    startOfMonth,
    endOfMonth,
    startOfPreviousMonth,
    endOfPreviousMonth,
  };
}

function normalizeStatusDistribution(distribution) {
  return {
    scheduled: distribution.SCHEDULED ?? 0,
    confirmed: distribution.CONFIRMED ?? 0,
    inAttendance: distribution.IN_ATTENDANCE ?? 0,
    finished: distribution.FINISHED ?? 0,
    canceled: distribution.CANCELED ?? 0,
    noShow: distribution.NO_SHOW ?? 0,
  };
}

function roundToTwo(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function calculateAverage(total, count) {
  if (!count) return 0;
  return roundToTwo(total / count);
}

function calculateRate(partial, total) {
  if (!total) return 0;
  return roundToTwo((partial / total) * 100);
}

function normalizeExecutiveStats(stats) {
  return {
    averageTicketToday: calculateAverage(
      stats.averageTicketToday.total,
      stats.averageTicketToday.count,
    ),
    averageTicketMonth: calculateAverage(
      stats.averageTicketMonth.total,
      stats.averageTicketMonth.count,
    ),
    totalAppointmentsToday: stats.totalAppointmentsToday,
    totalAppointmentsMonth: stats.totalAppointmentsMonth,
    totalAttendancesToday: stats.totalAttendancesToday,
    totalAttendancesMonth: stats.totalAttendancesMonth,
    cancellationRateMonth: calculateRate(
      stats.canceledAppointmentsMonth,
      stats.totalAppointmentsMonth,
    ),
    noShowRateMonth: calculateRate(
      stats.noShowAppointmentsMonth,
      stats.totalAppointmentsMonth,
    ),
  };
}

function normalizeTopServices(items) {
  return items.map((item) => ({
    serviceId: item.serviceId,
    name: item.name,
    quantity: Number(item.quantity ?? 0),
    total: roundToTwo(Number(item.total ?? 0)),
  }));
}

function normalizeTopProfessionals(items) {
  return items.map((item) => ({
    professionalId: item.professionalId,
    name: item.name,
    revenue: roundToTwo(Number(item.revenue ?? 0)),
    attendances: Number(item.attendances ?? 0),
  }));
}

function normalizeBusyHours(items) {
  return items.map((item) => ({
    hour: item.hour,
    appointments: Number(item.appointments ?? 0),
  }));
}

function normalizeMonthComparison(comparison) {
  const difference = roundToTwo(
    comparison.currentMonthRevenue - comparison.previousMonthRevenue,
  );

  return {
    currentMonthRevenue: roundToTwo(comparison.currentMonthRevenue),
    previousMonthRevenue: roundToTwo(comparison.previousMonthRevenue),
    difference,
    percentage:
      comparison.previousMonthRevenue === 0
        ? 0
        : roundToTwo((difference / comparison.previousMonthRevenue) * 100),
  };
}

export async function getDashboard() {
  const now = new Date();
  const {
    startOfDay,
    endOfDay,
    startOfMonth,
    endOfMonth,
    startOfPreviousMonth,
    endOfPreviousMonth,
  } = getDateRanges(now);
  const currentMonth = now.getMonth() + 1;

  const safe = (promise, fallback) => promise.catch((err) => {
    console.error("[dashboard] query parcial falhou:", err?.message ?? err);
    return fallback;
  });

  const [
    today,
    month,
    nextAppointment,
    birthdays,
    topClients,
    rawStatusDistribution,
    rawExecutive,
    rawTopServices,
    rawTopProfessionals,
    rawBusyHours,
    upcomingAppointments,
    rawMonthComparison,
  ] = await Promise.all([
    getTodayStats({ startOfDay, endOfDay }),
    getMonthStats({ startOfMonth, endOfMonth }),
    safe(getNextAppointment(now), null),
    safe(getBirthdays(currentMonth), []),
    safe(getTopClients(), []),
    safe(getStatusDistribution(), {}),
    getExecutiveStats({ startOfDay, endOfDay, startOfMonth, endOfMonth }),
    safe(getTopServices(), []),
    safe(getTopProfessionals(), []),
    safe(getBusyHours({ startOfMonth, endOfMonth }), []),
    safe(getUpcomingAppointments(now), []),
    safe(getMonthComparison({
      startOfCurrentMonth: startOfMonth,
      endOfCurrentMonth: endOfMonth,
      startOfPreviousMonth,
      endOfPreviousMonth,
    }), { currentMonthRevenue: 0, previousMonthRevenue: 0 }),
  ]);

  return {
    today,
    month,
    nextAppointment,
    birthdays,
    topClients,
    statusDistribution: normalizeStatusDistribution(rawStatusDistribution),
    executive: normalizeExecutiveStats(rawExecutive),
    topServices: normalizeTopServices(rawTopServices),
    topProfessionals: normalizeTopProfessionals(rawTopProfessionals),
    busyHours: normalizeBusyHours(rawBusyHours),
    upcomingAppointments,
    monthComparison: normalizeMonthComparison(rawMonthComparison),
  };
}
