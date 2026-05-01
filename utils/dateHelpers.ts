import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);

export const SHEET_DATE_FORMAT = 'DD/MM/YYYY';

export const toSheetDate = (d: dayjs.ConfigType = dayjs()): string =>
  dayjs(d).format(SHEET_DATE_FORMAT);

export const fromSheetDate = (s: string): dayjs.Dayjs =>
  dayjs(s, SHEET_DATE_FORMAT);

export const nowIso = (): string => dayjs().toISOString();

export const monthName = (d: dayjs.ConfigType = dayjs()): string =>
  dayjs(d).format('MMMM');

export const year = (d: dayjs.ConfigType = dayjs()): number =>
  dayjs(d).year();

export const monthYearLabel = (d: dayjs.ConfigType = dayjs()): string =>
  dayjs(d).format('MMMM YYYY');

export const dayLabel = (d: dayjs.ConfigType = dayjs()): string =>
  dayjs(d).format('D MMMM');

export const isSameMonth = (a: dayjs.ConfigType, b: dayjs.ConfigType): boolean =>
  dayjs(a).isSame(dayjs(b), 'month');

export const previousMonth = (
  month: string,
  yr: number,
): { month: string; year: number } => {
  const d = dayjs(`${month} ${yr}`, 'MMMM YYYY').subtract(1, 'month');
  return { month: d.format('MMMM'), year: d.year() };
};

export const nextMonth = (
  month: string,
  yr: number,
): { month: string; year: number } => {
  const d = dayjs(`${month} ${yr}`, 'MMMM YYYY').add(1, 'month');
  return { month: d.format('MMMM'), year: d.year() };
};

export const monthStart = (month: string, yr: number): Date =>
  dayjs(`${month} ${yr}`, 'MMMM YYYY').startOf('month').toDate();

export const monthEnd = (month: string, yr: number): Date =>
  dayjs(`${month} ${yr}`, 'MMMM YYYY').endOf('month').toDate();

export const isFutureMonth = (month: string, yr: number): boolean => {
  const target = dayjs(`${month} ${yr}`, 'MMMM YYYY').startOf('month');
  const current = dayjs().startOf('month');
  return target.isAfter(current);
};
