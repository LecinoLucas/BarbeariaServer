function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toCents(value) {
  return Math.round(toNumber(value) * 100);
}

export function getAttendanceBaseServiceCents(attendance) {
  return toCents(
    attendance?.appointment?.service?.price ??
      attendance?.service?.price ??
      0,
  );
}

export function getAttendanceItemsTotalCents(attendance) {
  return (attendance?.items ?? []).reduce((sum, item) => {
    return sum + toCents(item?.total);
  }, 0);
}

export function getAttendanceProductsTotalCents(attendance) {
  return (attendance?.productItems ?? []).reduce((sum, item) => {
    return sum + Math.round(toNumber(item?.totalPriceCents));
  }, 0);
}

export function calculateAttendanceTotals(attendance) {
  const serviceTotalCents = getAttendanceBaseServiceCents(attendance);
  const itemsTotalCents = getAttendanceItemsTotalCents(attendance);
  const productTotalCents = getAttendanceProductsTotalCents(attendance);

  return {
    serviceTotalCents,
    itemsTotalCents,
    productTotalCents,
    grandTotalCents: serviceTotalCents + itemsTotalCents + productTotalCents,
  };
}

export function calculateAttendanceTotal(attendance) {
  return calculateAttendanceTotals(attendance).grandTotalCents / 100;
}

export function withAttendanceTotal(attendance) {
  if (!attendance) return attendance;

  return {
    ...attendance,
    financialTotals: calculateAttendanceTotals(attendance),
    total: calculateAttendanceTotal(attendance),
  };
}

export function withAttendanceTotals(attendances) {
  return (attendances ?? []).map(withAttendanceTotal);
}
