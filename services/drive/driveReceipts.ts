import axios from 'axios';
import * as FileSystem from 'expo-file-system/legacy';
import { DRIVE_BASE, SHEET_FILE_PREFIX } from '../../constants/sheetConfig';
import { getFreshAccessToken } from '../auth/googleAuth';
import { secureStorage } from '../storage/secureStorage';

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3/files';

const folderName = (userName: string): string =>
  `${SHEET_FILE_PREFIX}${userName} — Receipts`;

const findFolder = async (
  token: string,
  name: string,
): Promise<string | null> => {
  const escaped = name.replace(/'/g, "\\'");
  const q = `name='${escaped}' and trashed=false and mimeType='${FOLDER_MIME}'`;
  const res = await axios.get<{ files: { id: string }[] }>(DRIVE_BASE, {
    params: { q, spaces: 'drive', fields: 'files(id,name)', pageSize: 5 },
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data.files?.[0]?.id ?? null;
};

const createFolder = async (token: string, name: string): Promise<string> => {
  const res = await axios.post<{ id: string }>(
    DRIVE_BASE,
    { name, mimeType: FOLDER_MIME },
    {
      params: { fields: 'id' },
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return res.data.id;
};

export const ensureReceiptsFolder = async (
  uid: string,
  userName: string,
): Promise<string> => {
  const cached = await secureStorage.getReceiptsFolder(uid);
  if (cached) return cached;

  const token = await getFreshAccessToken(uid);
  const name = folderName(userName);
  const found = await findFolder(token, name);
  const folderId = found ?? (await createFolder(token, name));
  await secureStorage.setReceiptsFolder(uid, folderId);
  return folderId;
};

export const uploadReceiptImage = async (
  uid: string,
  folderId: string,
  localUri: string,
  filename: string,
  mimeType: string,
): Promise<string> => {
  const token = await getFreshAccessToken(uid);

  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const boundary = `expmgr_${Date.now()}`;
  const metadata = { name: filename, parents: [folderId] };
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n` +
    'Content-Transfer-Encoding: base64\r\n\r\n' +
    `${base64}\r\n` +
    `--${boundary}--`;

  const res = await axios.post<{ id: string; webViewLink: string }>(
    UPLOAD_BASE,
    body,
    {
      params: { uploadType: 'multipart', fields: 'id,webViewLink' },
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      transformRequest: [(data) => data],
    },
  );

  return res.data.webViewLink;
};
