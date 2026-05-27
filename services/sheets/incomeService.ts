import { TABS, LAST_COLUMN } from '../../constants/sheetConfig';
import { nowIso } from '../../utils/dateHelpers';
import type { IncomeEntry } from '../../types';
import {
  readTab,
  appendRow,
  deleteRow,
  updateRow,
  parseAppendedRowNum,
  type Row,
} from './sheetsClient';

const TAB = TABS.extraIncome;
const LAST = LAST_COLUMN[TAB];

const rowToIncome = (row: string[], rowNum: number): IncomeEntry => ({
  id: String(rowNum),
  month: row[0] ?? '',
  year: Number(row[1] ?? 0),
  date: row[2] ?? '',
  paidBy: row[3] ?? '',
  amount: Number(row[4] ?? 0),
  notes: row[5] ?? '',
  // Back-compat: rows written before this column existed read as empty → 'in'.
  direction: (row[7] ?? '').toLowerCase() === 'out' ? 'out' : 'in',
});

const incomeToRow = (e: Omit<IncomeEntry, 'id'>, createdAt: string): Row => [
  e.month,
  e.year,
  e.date,
  e.paidBy,
  e.amount,
  e.notes,
  createdAt,
  e.direction,
];

export const listIncome = async (
  uid: string,
  sheetId: string,
  month?: string,
  year?: number,
): Promise<IncomeEntry[]> => {
  const rows = await readTab(uid, sheetId, TAB);
  const all = rows.slice(1).map((r, i) => rowToIncome(r, i + 2));
  if (month === undefined && year === undefined) return all;
  return all.filter(
    (e) =>
      (month === undefined || e.month === month) &&
      (year === undefined || e.year === year),
  );
};

export const addIncome = async (
  uid: string,
  sheetId: string,
  entry: Omit<IncomeEntry, 'id'>,
): Promise<IncomeEntry> => {
  const res = await appendRow(uid, sheetId, TAB, incomeToRow(entry, nowIso()));
  const rowNum = parseAppendedRowNum(res.updates.updatedRange) ?? -1;
  return { ...entry, id: String(rowNum) };
};

export const updateIncome = async (
  uid: string,
  sheetId: string,
  entry: IncomeEntry,
): Promise<IncomeEntry> => {
  const rowNum = Number(entry.id);
  if (!Number.isFinite(rowNum) || rowNum < 2) {
    throw new Error(`Invalid income id: ${entry.id}`);
  }
  await updateRow(uid, sheetId, TAB, rowNum, incomeToRow(entry, nowIso()), LAST);
  return entry;
};

export const removeIncome = async (
  uid: string,
  sheetId: string,
  tabGid: number,
  entryId: string,
): Promise<void> => {
  const rowNum = Number(entryId);
  if (!Number.isFinite(rowNum) || rowNum < 2) {
    throw new Error(`Invalid income id: ${entryId}`);
  }
  await deleteRow(uid, sheetId, tabGid, rowNum);
};

export const totalIncomeForMonth = (entries: IncomeEntry[]): number =>
  entries.reduce(
    (sum, e) => sum + (e.direction === 'out' ? -e.amount : e.amount),
    0,
  );

export const sumIncomeByDirection = (
  entries: IncomeEntry[],
): { received: number; returned: number } => {
  let received = 0;
  let returned = 0;
  for (const e of entries) {
    if (e.direction === 'out') returned += e.amount;
    else received += e.amount;
  }
  return { received, returned };
};
