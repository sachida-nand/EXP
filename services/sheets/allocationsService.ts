import { TABS } from '../../constants/sheetConfig';
import { nowIso } from '../../utils/dateHelpers';
import type { Allocation } from '../../types';
import { readTab, appendRow, batchUpdate, type Row } from './sheetsClient';

const TAB = TABS.allocations;

const rowToAllocation = (row: string[]): Allocation => ({
  month: row[0] ?? '',
  year: Number(row[1] ?? 0),
  bucketName: row[2] ?? '',
  bucketType: row[3] ?? '',
  allocatedAmount: Number(row[4] ?? 0),
  lastMonthAmount: Number(row[5] ?? 0),
});

const allocationToRow = (a: Allocation, createdAt: string): Row => [
  a.month,
  a.year,
  a.bucketName,
  a.bucketType,
  a.allocatedAmount,
  a.lastMonthAmount,
  createdAt,
];

const loadRows = async (
  uid: string,
  sheetId: string,
): Promise<{ rowNum: number; data: Allocation }[]> => {
  const rows = await readTab(uid, sheetId, TAB);
  return rows
    .slice(1)
    .map((row, i) => ({ rowNum: i + 2, data: rowToAllocation(row) }));
};

export const listAllocations = async (
  uid: string,
  sheetId: string,
  month: string,
  year: number,
): Promise<Allocation[]> => {
  const rows = await loadRows(uid, sheetId);
  return rows
    .filter((r) => r.data.month === month && r.data.year === year)
    .map((r) => r.data);
};

export const listAllAllocations = async (
  uid: string,
  sheetId: string,
): Promise<Allocation[]> => {
  const rows = await loadRows(uid, sheetId);
  return rows.map((r) => r.data);
};

export const saveAllocations = async (
  uid: string,
  sheetId: string,
  tabGid: number,
  month: string,
  year: number,
  allocations: Allocation[],
): Promise<void> => {
  const rows = await loadRows(uid, sheetId);
  const staleRowNums = rows
    .filter((r) => r.data.month === month && r.data.year === year)
    .map((r) => r.rowNum)
    .sort((a, b) => b - a);

  if (staleRowNums.length > 0) {
    await batchUpdate(
      uid,
      sheetId,
      staleRowNums.map((rowNum) => ({
        deleteDimension: {
          range: {
            sheetId: tabGid,
            dimension: 'ROWS',
            startIndex: rowNum - 1,
            endIndex: rowNum,
          },
        },
      })),
    );
  }

  const createdAt = nowIso();
  for (const a of allocations) {
    await appendRow(uid, sheetId, TAB, allocationToRow(a, createdAt));
  }
};
