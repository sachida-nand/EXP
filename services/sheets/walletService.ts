import { TABS, LAST_COLUMN } from '../../constants/sheetConfig';
import { nowIso } from '../../utils/dateHelpers';
import type { WalletSpend } from '../../types';
import {
  readTab,
  appendRow,
  deleteRow,
  updateRow,
  parseAppendedRowNum,
  type Row,
} from './sheetsClient';

const TAB = TABS.dailyWallet;
const LAST = LAST_COLUMN[TAB];

const rowToSpend = (row: string[], rowNum: number): WalletSpend => ({
  id: String(rowNum),
  date: row[0] ?? '',
  month: row[1] ?? '',
  year: Number(row[2] ?? 0),
  amount: Number(row[3] ?? 0),
  paidTo: row[4] ?? '',
  notes: row[6] ?? '',
  receiptLink: row[7] ?? '',
  balanceAfter: Number(row[8] ?? 0),
  // Back-compat: rows written before this column existed read as empty → deducts.
  deductsWallet: (row[10] ?? '').toLowerCase() !== 'false',
});

const spendToRow = (s: Omit<WalletSpend, 'id'>, createdAt: string): Row => [
  s.date,
  s.month,
  s.year,
  s.amount,
  s.paidTo,
  '',
  s.notes,
  s.receiptLink,
  s.balanceAfter,
  createdAt,
  s.deductsWallet ? 'true' : 'false',
];

export const listSpends = async (
  uid: string,
  sheetId: string,
  month?: string,
  year?: number,
): Promise<WalletSpend[]> => {
  const rows = await readTab(uid, sheetId, TAB);
  const all = rows.slice(1).map((r, i) => rowToSpend(r, i + 2));
  if (month === undefined && year === undefined) return all;
  return all.filter(
    (s) =>
      (month === undefined || s.month === month) &&
      (year === undefined || s.year === year),
  );
};

export const addSpend = async (
  uid: string,
  sheetId: string,
  spend: Omit<WalletSpend, 'id'>,
): Promise<WalletSpend> => {
  const res = await appendRow(uid, sheetId, TAB, spendToRow(spend, nowIso()));
  const rowNum = parseAppendedRowNum(res.updates.updatedRange) ?? -1;
  return { ...spend, id: String(rowNum) };
};

export const removeSpend = async (
  uid: string,
  sheetId: string,
  tabGid: number,
  spendId: string,
): Promise<void> => {
  const rowNum = Number(spendId);
  if (!Number.isFinite(rowNum) || rowNum < 2) {
    throw new Error(`Invalid spend id: ${spendId}`);
  }
  await deleteRow(uid, sheetId, tabGid, rowNum);
};

export const updateSpend = async (
  uid: string,
  sheetId: string,
  spend: WalletSpend,
): Promise<WalletSpend> => {
  const rowNum = Number(spend.id);
  if (!Number.isFinite(rowNum) || rowNum < 2) {
    throw new Error(`Invalid spend id: ${spend.id}`);
  }
  // Preserve the original created_at by reading just that cell of the existing
  // row would require a per-row read; cheaper to re-stamp on edit. Sheets'
  // created_at on this row now means "last edited at".
  await updateRow(uid, sheetId, TAB, rowNum, spendToRow(spend, nowIso()), LAST);
  return spend;
};

export const totalSpentForMonth = (spends: WalletSpend[]): number =>
  spends.reduce((sum, s) => (s.deductsWallet ? sum + s.amount : sum), 0);
