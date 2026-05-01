import axios, { AxiosError } from 'axios';
import {
  SHEETS_BASE,
  SHEET_FILE_PREFIX,
  DRIVE_BASE,
  TABS,
  HEADERS,
  type TabName,
} from '../../constants/sheetConfig';
import { getFreshAccessToken } from '../auth/googleAuth';
import { secureStorage } from '../storage/secureStorage';

const logGoogleError = (tag: string, err: unknown): Error => {
  const ax = err as AxiosError<{ error?: { code?: number; message?: string; status?: string; errors?: unknown } }>;
  const status = ax.response?.status;
  const data = ax.response?.data;
  const gErr = data?.error;
  console.log(`[${tag}] Google API error:`, {
    status,
    code: gErr?.code,
    googleStatus: gErr?.status,
    message: gErr?.message,
    errors: gErr?.errors,
    url: ax.config?.url,
    method: ax.config?.method,
    rawData: data,
  });
  const msg = gErr?.message
    ? `${status} ${gErr.status ?? ''}: ${gErr.message}`
    : ax.message || 'Request failed';
  return new Error(msg);
};

const ORDERED_TABS: TabName[] = [
  TABS.salary,
  TABS.allocations,
  TABS.dailyWallet,
  TABS.fixedPayments,
  TABS.purposes,
];

interface CreatedSpreadsheet {
  spreadsheetId: string;
  sheets: { properties: { sheetId: number; title: string } }[];
}

const buildCreateBody = (title: string) => ({
  properties: { title },
  sheets: ORDERED_TABS.map((tab) => ({
    properties: { title: tab },
    data: [
      {
        startRow: 0,
        startColumn: 0,
        rowData: [
          {
            values: HEADERS[tab].map((h) => ({
              userEnteredValue: { stringValue: h },
              userEnteredFormat: {
                textFormat: { bold: true },
                backgroundColor: { red: 0.93, green: 0.93, blue: 0.93 },
              },
            })),
          },
        ],
      },
    ],
  })),
});

const syncStoredAccountSheetId = async (
  uid: string,
  sheetId: string,
): Promise<void> => {
  const accounts = await secureStorage.getAccounts();
  const next = accounts.map((a) => (a.uid === uid ? { ...a, sheetId } : a));
  await secureStorage.setAccounts(next);
};

export interface EnsureSheetResult {
  sheetId: string;
  created: boolean;
  tabGids: Record<TabName, number>;
}

export const ensureUserSheet = async (
  uid: string,
  name: string,
): Promise<EnsureSheetResult> => {
  const existing = await secureStorage.getSheetId(uid);
  if (existing) {
    console.log('[ensureUserSheet] reusing existing sheet', existing);
    try {
      const gids = await fetchTabGids(uid, existing);
      return { sheetId: existing, created: false, tabGids: gids };
    } catch (err) {
      throw logGoogleError('fetchTabGids', err);
    }
  }

  const token = await getFreshAccessToken(uid);
  const title = `${SHEET_FILE_PREFIX}${name}`;

  const found = await findExistingSheetByTitle(token, title);
  if (found) {
    console.log('[ensureUserSheet] found sheet in Drive, reusing', found);
    try {
      const gids = await fetchTabGids(uid, found);
      await secureStorage.setSheetId(uid, found);
      await syncStoredAccountSheetId(uid, found);
      return { sheetId: found, created: false, tabGids: gids };
    } catch (err) {
      throw logGoogleError('fetchTabGids', err);
    }
  }

  console.log('[ensureUserSheet] creating sheet:', { title, tokenLen: token.length });

  try {
    const res = await axios.post<CreatedSpreadsheet>(
      SHEETS_BASE,
      buildCreateBody(title),
      { headers: { Authorization: `Bearer ${token}` } },
    );

    const sheetId = res.data.spreadsheetId;
    const tabGids = mapTabGids(res.data.sheets);
    console.log('[ensureUserSheet] created sheet', sheetId);

    await secureStorage.setSheetId(uid, sheetId);
    await syncStoredAccountSheetId(uid, sheetId);

    return { sheetId, created: true, tabGids };
  } catch (err) {
    throw logGoogleError('createSheet', err);
  }
};

interface DriveListResponse {
  files: { id: string; name: string }[];
}

const findExistingSheetByTitle = async (
  token: string,
  title: string,
): Promise<string | null> => {
  const escaped = title.replace(/'/g, "\\'");
  const q = `name='${escaped}' and trashed=false and mimeType='application/vnd.google-apps.spreadsheet'`;
  try {
    const res = await axios.get<DriveListResponse>(DRIVE_BASE, {
      params: { q, spaces: 'drive', fields: 'files(id,name)', pageSize: 10 },
      headers: { Authorization: `Bearer ${token}` },
    });
    const files = res.data.files ?? [];
    console.log('[findExistingSheet] results:', files);
    return files[0]?.id ?? null;
  } catch (err) {
    const ax = err as AxiosError;
    console.log('[findExistingSheet] lookup failed (continuing to create):', {
      status: ax.response?.status,
      message: ax.message,
    });
    return null;
  }
};

const mapTabGids = (
  sheets: CreatedSpreadsheet['sheets'],
): Record<TabName, number> => {
  const result = {} as Record<TabName, number>;
  for (const s of sheets) {
    result[s.properties.title as TabName] = s.properties.sheetId;
  }
  return result;
};

export const fetchTabGids = async (
  uid: string,
  sheetId: string,
): Promise<Record<TabName, number>> => {
  const token = await getFreshAccessToken(uid);
  const res = await axios.get<CreatedSpreadsheet>(
    `${SHEETS_BASE}/${sheetId}`,
    {
      params: { fields: 'sheets.properties' },
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return mapTabGids(res.data.sheets);
};
