import { TABS } from '../../constants/sheetConfig';
import { nowIso } from '../../utils/dateHelpers';
import type { WalletSpend } from '../../types';
import {
  readTab,
  appendRow,
  deleteRow,
  parseAppendedRowNum,
  type Row,
} from './sheetsClient';

const TAB = TABS.dailyWallet;

const rowToSpend = (row: string[], rowNum: number): WalletSpend => ({
  id: String(rowNum),
  date: row[0] ?? '',
  month: row[1] ?? '',
  year: Number(row[2] ?? 0),
  amount: Number(row[3] ?? 0),
  paidTo: row[4] ?? '',
  purpose: row[5] ?? '',
  notes: row[6] ?? '',
  receiptLink: row[7] ?? '',
  balanceAfter: Number(row[8] ?? 0),
});

const spendToRow = (s: Omit<WalletSpend, 'id'>, createdAt: string): Row => [
  s.date,
  s.month,
  s.year,
  s.amount,
  s.paidTo,
  s.purpose,
  s.notes,
  s.receiptLink,
  s.balanceAfter,
  createdAt,
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

export const totalSpentForMonth = (spends: WalletSpend[]): number =>
  spends.reduce((sum, s) => sum + s.amount, 0);
