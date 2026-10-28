import { addDays } from "date-fns";
import { es } from "date-fns/locale";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { DEFAULT_TIMEZONE } from "./constants";

export function dateKey(date: Date = new Date(), timezone = DEFAULT_TIMEZONE) {
  return formatInTimeZone(date, timezone, "yyyy-MM-dd");
}

export function parseDateKey(key: string, timezone = DEFAULT_TIMEZONE) {
  return fromZonedTime(`${key} 00:00:00`, timezone);
}

export function endOfDayKey(key: string, timezone = DEFAULT_TIMEZONE) {
  return fromZonedTime(`${key} 23:59:59.999`, timezone);
}

export function addDaysToKey(key: string, days: number, timezone = DEFAULT_TIMEZONE) {
  const next = addDays(parseDateKey(key, timezone), days);
  return formatInTimeZone(next, timezone, "yyyy-MM-dd");
}

export function todayKey(timezone = DEFAULT_TIMEZONE) {
  return dateKey(new Date(), timezone);
}

export function weekdayOfKey(key: string, timezone = DEFAULT_TIMEZONE) {
  return Number(formatInTimeZone(parseDateKey(key, timezone), timezone, "i")) % 7;
}

export function instantAtKeyMinute(
  key: string,
  minutes: number,
  timezone = DEFAULT_TIMEZONE,
) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return fromZonedTime(
    `${key} ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`,
    timezone,
  );
}

export function minutesOfDay(date: Date, timezone = DEFAULT_TIMEZONE) {
  const h = Number(formatInTimeZone(date, timezone, "H"));
  const m = Number(formatInTimeZone(date, timezone, "m"));
  return h * 60 + m;
}

export function minutesToTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(
    minutes % 60,
  ).padStart(2, "0")}`;
}

export function timeToMinutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

export function formatTime(date: Date, timezone = DEFAULT_TIMEZONE) {
  return formatInTimeZone(date, timezone, "HH:mm");
}

export function formatTimeRange(
  start: Date,
  end: Date,
  timezone = DEFAULT_TIMEZONE,
) {
  return `${formatTime(start, timezone)} – ${formatTime(end, timezone)}`;
}

export function formatDate(
  date: Date,
  pattern = "EEE d MMM",
  timezone = DEFAULT_TIMEZONE,
) {
  return formatInTimeZone(date, timezone, pattern, { locale: es });
}

export function formatDateTime(date: Date, timezone = DEFAULT_TIMEZONE) {
  return formatInTimeZone(date, timezone, "EEE d MMM · HH:mm", { locale: es });
}

export function formatLongDate(date: Date, timezone = DEFAULT_TIMEZONE) {
  return formatInTimeZone(date, timezone, "EEEE d 'de' MMMM", { locale: es });
}

export function formatMonthDay(date: Date, timezone = DEFAULT_TIMEZONE) {
  return formatInTimeZone(date, timezone, "d 'de' MMMM", { locale: es });
}

export function formatDateInput(date: Date, timezone = DEFAULT_TIMEZONE) {
  return formatInTimeZone(date, timezone, "yyyy-MM-dd");
}

export function formatTimeInput(date: Date, timezone = DEFAULT_TIMEZONE) {
  return formatInTimeZone(date, timezone, "HH:mm");
}

/**
 * Verifica que una cadena sea una zona horaria IANA válida.
 * Se usa para impedir que un ajuste mal escrito rompa toda la agenda: las
 * funciones de `date-fns-tz` lanzan si reciben una zona desconocida.
 */
export function isValidTimeZone(timezone: string) {
  if (!timezone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export type DayOption = {
  key: string;
  weekdayShort: string;
  dayNumber: string;
  monthShort: string;
  label: string;
  isToday: boolean;
  isClosed: boolean;
};

export function nextDays(
  count: number,
  closedWeekdays: number[] = [],
  timezone = DEFAULT_TIMEZONE,
): DayOption[] {
  const today = todayKey(timezone);
  return Array.from({ length: count }, (_, index) => {
    const key = addDaysToKey(today, index, timezone);
    const date = parseDateKey(key, timezone);
    const weekday = weekdayOfKey(key, timezone);
    return {
      key,
      weekdayShort: formatInTimeZone(date, timezone, "EEE", { locale: es }),
      dayNumber: formatInTimeZone(date, timezone, "d"),
      monthShort: formatInTimeZone(date, timezone, "MMM", { locale: es }),
      label: formatInTimeZone(date, timezone, "EEEE d 'de' MMMM", {
        locale: es,
      }),
      isToday: key === today,
      isClosed: closedWeekdays.includes(weekday),
    };
  });
}
