import * as SecureStore from 'expo-secure-store';
import type { StoredAccount, Bucket } from '../../types';

const K = {
  activeUid: 'active_uid',
  accounts: 'accounts',
  token: (uid: string) => `u_${uid}_token`,
  refreshToken: (uid: string) => `u_${uid}_refresh`,
  tokenExpiry: (uid: string) => `u_${uid}_expiry`,
  pin: (uid: string) => `u_${uid}_pin`,
  sheetId: (uid: string) => `u_${uid}_sheet`,
  biometric: (uid: string) => `u_${uid}_bio`,
  salaryDay: (uid: string) => `u_${uid}_salday`,
  currency: (uid: string) => `u_${uid}_currency`,
  buckets: (uid: string) => `u_${uid}_buckets`,
  receiptsFolder: (uid: string) => `u_${uid}_receiptsFolder`,
  paidToRecents: (uid: string) => `u_${uid}_paidToRecents`,
};

const PAID_TO_MAX = 25;

const getRaw = async (key: string): Promise<string | null> => {
  const v = await SecureStore.getItemAsync(key);
  return v ?? null;
};

const setRaw = (key: string, value: string): Promise<void> =>
  SecureStore.setItemAsync(key, value);

const removeRaw = (key: string): Promise<void> =>
  SecureStore.deleteItemAsync(key);

const getJson = async <T>(key: string): Promise<T | null> => {
  const raw = await getRaw(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const setJson = <T>(key: string, value: T): Promise<void> =>
  setRaw(key, JSON.stringify(value));

export const secureStorage = {
  getActiveUid: () => getRaw(K.activeUid),
  setActiveUid: (uid: string) => setRaw(K.activeUid, uid),
  clearActiveUid: () => removeRaw(K.activeUid),

  getAccounts: async (): Promise<StoredAccount[]> =>
    (await getJson<StoredAccount[]>(K.accounts)) ?? [],
  setAccounts: (list: StoredAccount[]) => setJson(K.accounts, list),

  getToken: (uid: string) => getRaw(K.token(uid)),
  setToken: (uid: string, token: string) => setRaw(K.token(uid), token),

  getRefreshToken: (uid: string) => getRaw(K.refreshToken(uid)),
  setRefreshToken: (uid: string, token: string) =>
    setRaw(K.refreshToken(uid), token),

  getTokenExpiry: async (uid: string): Promise<number | null> => {
    const v = await getRaw(K.tokenExpiry(uid));
    return v ? Number(v) : null;
  },
  setTokenExpiry: (uid: string, epochMs: number) =>
    setRaw(K.tokenExpiry(uid), String(epochMs)),

  getPinHash: (uid: string) => getRaw(K.pin(uid)),
  setPinHash: (uid: string, hash: string) => setRaw(K.pin(uid), hash),

  getSheetId: (uid: string) => getRaw(K.sheetId(uid)),
  setSheetId: (uid: string, sheetId: string) =>
    setRaw(K.sheetId(uid), sheetId),

  getBiometricEnabled: async (uid: string): Promise<boolean> =>
    (await getRaw(K.biometric(uid))) === 'true',
  setBiometricEnabled: (uid: string, enabled: boolean) =>
    setRaw(K.biometric(uid), enabled ? 'true' : 'false'),

  getSalaryDay: async (uid: string): Promise<number | null> => {
    const v = await getRaw(K.salaryDay(uid));
    return v ? Number(v) : null;
  },
  setSalaryDay: (uid: string, day: number) =>
    setRaw(K.salaryDay(uid), String(day)),

  getCurrency: (uid: string) => getRaw(K.currency(uid)),
  setCurrency: (uid: string, currency: string) =>
    setRaw(K.currency(uid), currency),

  getBuckets: async (uid: string): Promise<Bucket[] | null> =>
    getJson<Bucket[]>(K.buckets(uid)),
  setBuckets: (uid: string, buckets: Bucket[]) =>
    setJson(K.buckets(uid), buckets),

  getReceiptsFolder: (uid: string) => getRaw(K.receiptsFolder(uid)),
  setReceiptsFolder: (uid: string, folderId: string) =>
    setRaw(K.receiptsFolder(uid), folderId),

  getPaidToRecents: async (uid: string): Promise<string[]> =>
    (await getJson<string[]>(K.paidToRecents(uid))) ?? [],
  addPaidToRecent: async (uid: string, value: string): Promise<void> => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const current = (await getJson<string[]>(K.paidToRecents(uid))) ?? [];
    const lower = trimmed.toLowerCase();
    const filtered = current.filter((v) => v.toLowerCase() !== lower);
    const next = [trimmed, ...filtered].slice(0, PAID_TO_MAX);
    await setJson(K.paidToRecents(uid), next);
  },

  removeAccount: async (uid: string): Promise<void> => {
    await Promise.all([
      removeRaw(K.token(uid)),
      removeRaw(K.refreshToken(uid)),
      removeRaw(K.tokenExpiry(uid)),
      removeRaw(K.pin(uid)),
      removeRaw(K.sheetId(uid)),
      removeRaw(K.biometric(uid)),
      removeRaw(K.salaryDay(uid)),
      removeRaw(K.currency(uid)),
      removeRaw(K.buckets(uid)),
      removeRaw(K.receiptsFolder(uid)),
      removeRaw(K.paidToRecents(uid)),
    ]);
    const accounts = await secureStorage.getAccounts();
    await secureStorage.setAccounts(accounts.filter((a) => a.uid !== uid));
    const active = await secureStorage.getActiveUid();
    if (active === uid) await secureStorage.clearActiveUid();
  },
};
