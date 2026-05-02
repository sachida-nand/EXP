import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import type { PaymentDraft } from '../../types';

const draftsKey = (uid: string): string => `u_${uid}_drafts`;

const draftsDir = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}drafts/`
  : null;

const ensureDraftsDir = async (): Promise<void> => {
  if (!draftsDir) return;
  const info = await FileSystem.getInfoAsync(draftsDir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(draftsDir, { intermediates: true });
  }
};

const reviveDate = (d: PaymentDraft): PaymentDraft => ({
  ...d,
  parsed: {
    ...d.parsed,
    date: new Date(d.parsed.date),
  },
});

export const listDrafts = async (uid: string): Promise<PaymentDraft[]> => {
  const raw = await SecureStore.getItemAsync(draftsKey(uid));
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as PaymentDraft[];
    return arr.map(reviveDate);
  } catch {
    return [];
  }
};

const writeDrafts = async (
  uid: string,
  drafts: PaymentDraft[],
): Promise<void> => {
  await SecureStore.setItemAsync(draftsKey(uid), JSON.stringify(drafts));
};

export const persistScreenshot = async (uri: string): Promise<string> => {
  if (!draftsDir) return uri;
  await ensureDraftsDir();
  const ext = uri.match(/\.(jpe?g|png|webp|heic)(?:$|\?)/i)?.[1] ?? 'jpg';
  const target = `${draftsDir}draft-${Date.now()}.${ext.toLowerCase()}`;
  try {
    await FileSystem.copyAsync({ from: uri, to: target });
    return target;
  } catch (err) {
    console.warn('[drafts] copy failed, falling back to original uri', err);
    return uri;
  }
};

export const saveDraft = async (
  uid: string,
  draft: PaymentDraft,
): Promise<void> => {
  const current = await listDrafts(uid);
  const without = current.filter((d) => d.id !== draft.id);
  await writeDrafts(uid, [draft, ...without]);
};

export const removeDraft = async (
  uid: string,
  id: string,
): Promise<void> => {
  const current = await listDrafts(uid);
  const target = current.find((d) => d.id === id);
  const next = current.filter((d) => d.id !== id);
  await writeDrafts(uid, next);
  if (target?.screenshotUri && target.screenshotUri.startsWith(draftsDir ?? '')) {
    try {
      await FileSystem.deleteAsync(target.screenshotUri, { idempotent: true });
    } catch (err) {
      console.warn('[drafts] failed to delete screenshot file', err);
    }
  }
};

export const newDraftId = (): string =>
  `d_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
