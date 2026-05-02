import axios from 'axios';
import * as FileSystem from 'expo-file-system/legacy';
import { DRIVE_BASE, SHEET_FILE_PREFIX } from '../../constants/sheetConfig';
import { getFreshAccessToken } from '../auth/googleAuth';
import { secureStorage } from '../storage/secureStorage';

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3/files';

const receiptsFolderName = (userName: string): string =>
  `${SHEET_FILE_PREFIX}${userName} — Receipts`;

const parentFolderName = (userName: string): string =>
  `${SHEET_FILE_PREFIX}${userName}`;

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

const createFolder = async (
  token: string,
  name: string,
  parentId?: string,
): Promise<string> => {
  const body: { name: string; mimeType: string; parents?: string[] } = {
    name,
    mimeType: FOLDER_MIME,
  };
  if (parentId) body.parents = [parentId];
  const res = await axios.post<{ id: string }>(DRIVE_BASE, body, {
    params: { fields: 'id' },
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data.id;
};

export const ensureExpenseManagerFolder = async (
  uid: string,
  userName: string,
): Promise<string> => {
  const cached = await secureStorage.getParentFolder(uid);
  if (cached) return cached;

  const token = await getFreshAccessToken(uid);
  const name = parentFolderName(userName);
  const found = await findFolder(token, name);
  const folderId = found ?? (await createFolder(token, name));
  await secureStorage.setParentFolder(uid, folderId);
  return folderId;
};

export const ensureReceiptsFolder = async (
  uid: string,
  userName: string,
): Promise<string> => {
  const cached = await secureStorage.getReceiptsFolder(uid);
  if (cached) return cached;

  const token = await getFreshAccessToken(uid);
  const name = receiptsFolderName(userName);
  const found = await findFolder(token, name);
  if (found) {
    await secureStorage.setReceiptsFolder(uid, found);
    return found;
  }
  // First-time creation: nest inside the Expense Manager parent folder so new
  // users get the organized layout from day one.
  const parentId = await ensureExpenseManagerFolder(uid, userName);
  const folderId = await createFolder(token, name, parentId);
  await secureStorage.setReceiptsFolder(uid, folderId);
  return folderId;
};

const moveFile = async (
  token: string,
  fileId: string,
  newParentId: string,
): Promise<void> => {
  const res = await axios.get<{ parents?: string[] }>(
    `${DRIVE_BASE}/${fileId}`,
    {
      params: { fields: 'parents' },
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  const currentParents = res.data.parents ?? [];
  if (currentParents.includes(newParentId)) return;
  await axios.patch(
    `${DRIVE_BASE}/${fileId}`,
    {},
    {
      params: {
        addParents: newParentId,
        removeParents: currentParents.join(','),
        fields: 'id,parents',
      },
      headers: { Authorization: `Bearer ${token}` },
    },
  );
};

// Idempotent: ensures the user's spreadsheet (and receipts folder, if it
// already exists) live inside the Expense Manager parent folder. Safe to call
// repeatedly — existing users get migrated once on next launch, then a cached
// flag short-circuits subsequent runs.
export const ensureDriveLayout = async (
  uid: string,
  userName: string,
  sheetId: string,
): Promise<void> => {
  if (await secureStorage.getDriveLayoutMigrated(uid)) return;

  const token = await getFreshAccessToken(uid);
  const parentId = await ensureExpenseManagerFolder(uid, userName);

  await moveFile(token, sheetId, parentId);

  // The receipts folder may not exist yet. Look it up by name only — if absent,
  // skip; it'll get created inside the parent on the user's first upload.
  const receiptsFolderId = await findFolder(token, receiptsFolderName(userName));
  if (receiptsFolderId) {
    await moveFile(token, receiptsFolderId, parentId);
    await secureStorage.setReceiptsFolder(uid, receiptsFolderId);
  }

  await secureStorage.setDriveLayoutMigrated(uid, true);
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
