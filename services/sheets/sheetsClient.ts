import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { getFreshAccessToken } from '../auth/googleAuth';
import { secureStorage } from '../storage/secureStorage';
import { SHEETS_BASE } from '../../constants/sheetConfig';

export type Cell = string | number | boolean;
export type Row = Cell[];

const encodeRange = (range: string): string => encodeURIComponent(range);

const withAuth = async (
  uid: string,
  config: AxiosRequestConfig,
): Promise<AxiosRequestConfig> => {
  const token = await getFreshAccessToken(uid);
  return {
    ...config,
    headers: { ...(config.headers ?? {}), Authorization: `Bearer ${token}` },
  };
};

const request = async <T>(
  uid: string,
  config: AxiosRequestConfig,
  retried = false,
): Promise<T> => {
  try {
    const res = await axios.request<T>(await withAuth(uid, config));
    return res.data;
  } catch (err) {
    const ax = err as AxiosError;
    if (!retried && ax.response?.status === 401) {
      await secureStorage.setTokenExpiry(uid, 0);
      return request<T>(uid, config, true);
    }
    throw err;
  }
};

interface ValuesResponse {
  range: string;
  values?: string[][];
}

export interface AppendResponse {
  spreadsheetId: string;
  updates: {
    updatedRange: string;
    updatedRows: number;
    updatedColumns: number;
    updatedCells: number;
  };
}

export const readTab = async (
  uid: string,
  sheetId: string,
  tab: string,
): Promise<string[][]> => {
  const data = await request<ValuesResponse>(uid, {
    method: 'GET',
    url: `${SHEETS_BASE}/${sheetId}/values/${encodeRange(tab)}`,
  });
  return data.values ?? [];
};

export const readRange = async (
  uid: string,
  sheetId: string,
  range: string,
): Promise<string[][]> => {
  const data = await request<ValuesResponse>(uid, {
    method: 'GET',
    url: `${SHEETS_BASE}/${sheetId}/values/${encodeRange(range)}`,
  });
  return data.values ?? [];
};

export const appendRow = async (
  uid: string,
  sheetId: string,
  tab: string,
  row: Row,
): Promise<AppendResponse> =>
  request<AppendResponse>(uid, {
    method: 'POST',
    url: `${SHEETS_BASE}/${sheetId}/values/${encodeRange(`${tab}!A1`)}:append`,
    params: {
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
    },
    data: { values: [row] },
  });

export const updateRow = async (
  uid: string,
  sheetId: string,
  tab: string,
  rowNum: number,
  row: Row,
  lastCol: string,
): Promise<void> => {
  await request(uid, {
    method: 'PUT',
    url: `${SHEETS_BASE}/${sheetId}/values/${encodeRange(
      `${tab}!A${rowNum}:${lastCol}${rowNum}`,
    )}`,
    params: { valueInputOption: 'USER_ENTERED' },
    data: { values: [row] },
  });
};

export const batchUpdate = async <T = unknown>(
  uid: string,
  sheetId: string,
  requests: unknown[],
): Promise<T> =>
  request<T>(uid, {
    method: 'POST',
    url: `${SHEETS_BASE}/${sheetId}:batchUpdate`,
    data: { requests },
  });

export const deleteRow = async (
  uid: string,
  sheetId: string,
  tabGid: number,
  rowNum: number,
): Promise<void> => {
  await batchUpdate(uid, sheetId, [
    {
      deleteDimension: {
        range: {
          sheetId: tabGid,
          dimension: 'ROWS',
          startIndex: rowNum - 1,
          endIndex: rowNum,
        },
      },
    },
  ]);
};

export const parseAppendedRowNum = (updatedRange: string): number | null => {
  const m = updatedRange.match(/![A-Z]+(\d+)/);
  return m ? Number(m[1]) : null;
};

export const getSheetMeta = async (
  uid: string,
  sheetId: string,
): Promise<{
  spreadsheetId: string;
  properties: { title: string };
  sheets: { properties: { sheetId: number; title: string } }[];
}> =>
  request(uid, {
    method: 'GET',
    url: `${SHEETS_BASE}/${sheetId}`,
    params: { fields: 'spreadsheetId,properties.title,sheets.properties' },
  });
