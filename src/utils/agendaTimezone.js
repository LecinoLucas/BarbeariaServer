import { DateTime } from "luxon";

export const AGENDA_TIME_ZONE = "America/Sao_Paulo";

const BUSINESS_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const BUSINESS_TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

function assertUtcDateInstance(date, label = "date") {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new RangeError(`${label} inválido.`);
  }

  return date;
}

export function assertBusinessDate(dateString) {
  if (typeof dateString !== "string" || !BUSINESS_DATE_REGEX.test(dateString)) {
    throw new RangeError("Data de negócio inválida. Use YYYY-MM-DD.");
  }

  const parsed = DateTime.fromISO(dateString, {
    zone: AGENDA_TIME_ZONE,
  });

  if (!parsed.isValid || parsed.toFormat("yyyy-MM-dd") !== dateString) {
    throw new RangeError("Data de negócio inválida. Use YYYY-MM-DD.");
  }

  return dateString;
}

export function assertBusinessTime(timeString) {
  if (typeof timeString !== "string" || !BUSINESS_TIME_REGEX.test(timeString)) {
    throw new RangeError("Horário de negócio inválido. Use HH:mm.");
  }

  const parsed = DateTime.fromFormat(timeString, "HH:mm", {
    zone: AGENDA_TIME_ZONE,
  });

  if (!parsed.isValid || parsed.toFormat("HH:mm") !== timeString) {
    throw new RangeError("Horário de negócio inválido. Use HH:mm.");
  }

  return timeString;
}

export function getBusinessDayUtcRange(dateString) {
  const businessDate = assertBusinessDate(dateString);
  const day = DateTime.fromISO(businessDate, {
    zone: AGENDA_TIME_ZONE,
  });

  return {
    startUtc: day.startOf("day").toUTC().toJSDate(),
    endUtc: day.endOf("day").toUTC().toJSDate(),
  };
}

export function combineBusinessDateAndTimeToUtc(dateString, timeString) {
  const businessDate = assertBusinessDate(dateString);
  const businessTime = assertBusinessTime(timeString);
  const dateTime = DateTime.fromISO(`${businessDate}T${businessTime}`, {
    zone: AGENDA_TIME_ZONE,
  });

  if (!dateTime.isValid) {
    throw new RangeError("Data/hora de negócio inválida.");
  }

  return dateTime.toUTC().toJSDate();
}

export function getBusinessDateKeyFromUtc(date) {
  const utcDate = assertUtcDateInstance(date);

  return DateTime.fromJSDate(utcDate, { zone: "utc" })
    .setZone(AGENDA_TIME_ZONE)
    .toFormat("yyyy-MM-dd");
}

export function getBusinessTimeFromUtc(date) {
  const utcDate = assertUtcDateInstance(date);

  return DateTime.fromJSDate(utcDate, { zone: "utc" })
    .setZone(AGENDA_TIME_ZONE)
    .toFormat("HH:mm");
}

export function getWeekdayInBusinessZone(dateString) {
  const businessDate = assertBusinessDate(dateString);
  const weekday = DateTime.fromISO(businessDate, {
    zone: AGENDA_TIME_ZONE,
  }).weekday;

  return weekday % 7;
}

export function addMinutesUtc(date, minutes) {
  const utcDate = assertUtcDateInstance(date);

  if (typeof minutes !== "number" || !Number.isFinite(minutes)) {
    throw new RangeError("minutes inválido.");
  }

  return new Date(utcDate.getTime() + minutes * 60 * 1000);
}
