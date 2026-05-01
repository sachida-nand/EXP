import { TABS } from '../../constants/sheetConfig';
import { nowIso } from '../../utils/dateHelpers';
import type { FixedPayment } from '../../types';
import {
  readTab,
  appendRow,
  deleteRow,
  parseAppendedRowNum,
  type Row,
} from './sheetsClient';

const TAB = TABS.fixedPayments;

const rowToPayment = (row: string[], rowNum: number): FixedPayment => ({
  id: String(rowNum),
  month: row[0] ?? '',
  year: Number(row[1] ?? 0),
  bucketName: row[2] ?? '',
  paymentType: (row[3] === 'given' ? 'given' : 'paid') as FixedPayment['paymentType'],
  amount: Number(row[4] ?? 0),
  paidTo: row[5] ?? '',
  datePaid: row[6] ?? '',
  receiptLink: row[7] ?? '',
  notes: row[9] ?? '',
});

const paymentToRow = (p: Omit<FixedPayment, 'id'>, createdAt: string): Row => [
  p.month,
  p.year,
  p.bucketName,
  p.paymentType,
  p.amount,
  p.paidTo,
  p.datePaid,
  p.receiptLink,
  createdAt,
  p.notes,
];

const loadRows = async (
  uid: string,
  sheetId: string,
): Promise<{ rowNum: number; data: FixedPayment }[]> => {
  const rows = await readTab(uid, sheetId, TAB);
  return rows
    .slice(1)
    .map((row, i) => ({ rowNum: i + 2, data: rowToPayment(row, i + 2) }));
};

export const listFixedPayments = async (
  uid: string,
  sheetId: string,
  month: string,
  year: number,
): Promise<FixedPayment[]> => {
  const rows = await loadRows(uid, sheetId);
  return rows
    .filter((r) => r.data.month === month && r.data.year === year)
    .map((r) => r.data);
};

export const listAllFixedPayments = async (
  uid: string,
  sheetId: string,
): Promise<FixedPayment[]> => {
  const rows = await loadRows(uid, sheetId);
  return rows.map((r) => r.data);
};

export const addFixedPayment = async (
  uid: string,
  sheetId: string,
  payment: Omit<FixedPayment, 'id'>,
): Promise<FixedPayment> => {
  const rowValues = paymentToRow(payment, nowIso());
  const res = await appendRow(uid, sheetId, TAB, rowValues);
  const rowNum = parseAppendedRowNum(res.updates.updatedRange) ?? -1;
  return { ...payment, id: String(rowNum) };
};

export const removeFixedPayment = async (
  uid: string,
  sheetId: string,
  tabGid: number,
  paymentId: string,
): Promise<void> => {
  const rowNum = Number(paymentId);
  if (!Number.isFinite(rowNum) || rowNum < 2) {
    throw new Error(`Invalid payment id: ${paymentId}`);
  }
  await deleteRow(uid, sheetId, tabGid, rowNum);
};
