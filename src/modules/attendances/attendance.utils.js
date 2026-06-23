function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getAttendanceBaseServiceAmount(attendance) {
  return toNumber(
    attendance?.appointment?.service?.price ??
      attendance?.service?.price ??
      0,
  );
}

export function getAttendanceItemsTotal(attendance) {
  return (attendance?.items ?? []).reduce((sum, item) => {
    return sum + toNumber(item?.total);
  }, 0);
}

export function calculateAttendanceTotal(attendance) {
  const total = getAttendanceBaseServiceAmount(attendance) + getAttendanceItemsTotal(attendance);
  return parseFloat(total.toFixed(2));
}

export function withAttendanceTotal(attendance) {
  if (!attendance) return attendance;

  return {
    ...attendance,
    total: calculateAttendanceTotal(attendance),
  };
}

export function withAttendanceTotals(attendances) {
  return (attendances ?? []).map(withAttendanceTotal);
}
