import { TABS, LAST_COLUMN } from '../../constants/sheetConfig';
import { nowIso } from '../../utils/dateHelpers';
import type { MonthData } from '../../types';
import {
  readTab,
  appendRow,
  updateRow,
  parseAppendedRowNum,
  type Row,
} from './sheetsClient';

const TAB = TABS.salary;
const LAST = LAST_COLUMN[TAB];

const rowToMonthData = (row: string[]): MonthData => ({
  month: row[0] ?? '',
  year: Number(row[1] ?? 0),
  salaryAmount: Number(row[2] ?? 0),
  source: row[3] ?? '',
  dateCredited: row[4] ?? '',
  carryForward: Number(row[5] ?? 0),
});

const monthDataToRow = (d: MonthData, createdAt: string): Row => [
  d.month,
  d.year,
  d.salaryAmount,
  d.source,
  d.dateCredited,
  d.carryForward,
  createdAt,
];

const loadRows = async (
  uid: string,
  sheetId: string,
): Promise<{ rowNum: number; data: MonthData }[]> => {
  const rows = await readTab(uid, sheetId, TAB);
  return rows
    .slice(1)
    .map((row, i) => ({ rowNum: i + 2, data: rowToMonthData(row) }));
};

export const listSalary = async (
  uid: string,
  sheetId: string,
): Promise<MonthData[]> => {
  const rows = await loadRows(uid, sheetId);
  return rows.map((r) => r.data);
};

export const getSalaryFor = async (
  uid: string,
  sheetId: string,
  month: string,
  year: number,
): Promise<MonthData | null> => {
  const rows = await loadRows(uid, sheetId);
  const hit = rows.find(
    (r) => r.data.month === month && r.data.year === year,
  );
  return hit?.data ?? null;
};

export const saveSalary = async (
  uid: string,
  sheetId: string,
  data: MonthData,
): Promise<{ rowNum: number }> => {
  const rows = await loadRows(uid, sheetId);
  const existing = rows.find(
    (r) => r.data.month === data.month && r.data.year === data.year,
  );
  const rowValues = monthDataToRow(data, nowIso());

  if (existing) {
    await updateRow(uid, sheetId, TAB, existing.rowNum, rowValues, LAST);
    return { rowNum: existing.rowNum };
  }
  const res = await appendRow(uid, sheetId, TAB, rowValues);
  return { rowNum: parseAppendedRowNum(res.updates.updatedRange) ?? -1 };
};
