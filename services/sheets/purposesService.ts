import { TABS } from '../../constants/sheetConfig';
import { nowIso } from '../../utils/dateHelpers';
import type { Purpose } from '../../types';
import { readTab, appendRow } from './sheetsClient';

const TAB = TABS.purposes;

const rowToPurpose = (row: string[]): Purpose => ({
  name: row[0] ?? '',
  createdAt: row[1] ?? '',
});

export const listPurposes = async (
  uid: string,
  sheetId: string,
): Promise<Purpose[]> => {
  const rows = await readTab(uid, sheetId, TAB);
  return rows.slice(1).map(rowToPurpose).filter((p) => p.name);
};

export const addPurpose = async (
  uid: string,
  sheetId: string,
  name: string,
): Promise<Purpose> => {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Purpose name cannot be empty');
  const existing = await listPurposes(uid, sheetId);
  const already = existing.find(
    (p) => p.name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (already) return already;

  const createdAt = nowIso();
  await appendRow(uid, sheetId, TAB, [trimmed, createdAt]);
  return { name: trimmed, createdAt };
};
