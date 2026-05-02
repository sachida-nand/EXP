import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  inMemoryPersistence,
  GoogleAuthProvider,
  signInWithCredential,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { secureStorage } from '../storage/secureStorage';
import { nowIso } from '../../utils/dateHelpers';
import type { StoredAccount } from '../../types';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY as string,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN as string,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID as string,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID as string,
};

const isNewApp = getApps().length === 0;
const firebaseApp = isNewApp ? initializeApp(firebaseConfig) : getApp();
export const firebaseAuth = isNewApp
  ? initializeAuth(firebaseApp, { persistence: inMemoryPersistence })
  : getAuth(firebaseApp);

const SCOPES = [
  'profile',
  'email',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
];

const TOKEN_LIFETIME_MS = 55 * 60 * 1000;
const REFRESH_BUFFER_MS = 60 * 1000;

let configured = false;
export const configureGoogleSignIn = (): void => {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID as string,
    scopes: SCOPES,
    offlineAccess: false,
  });
  configured = true;
};

export interface GoogleUser {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
}

export interface SignInResult {
  user: GoogleUser;
  accessToken: string;
  idToken: string;
  isNewAccount: boolean;
}

export const signInWithGoogle = async (): Promise<SignInResult> => {
  configureGoogleSignIn();
  await GoogleSignin.hasPlayServices();

  const result = await GoogleSignin.signIn();
  if (result.type !== 'success') {
    throw new Error('Sign-in cancelled');
  }
  const { idToken, user: gUser } = result.data;
  if (!idToken) throw new Error('No idToken returned from Google');

  const { accessToken } = await GoogleSignin.getTokens();

  const credential = GoogleAuthProvider.credential(idToken, accessToken);
  const fbCred = await signInWithCredential(firebaseAuth, credential);

  const uid = fbCred.user.uid;
  const name = fbCred.user.displayName ?? gUser.name ?? 'User';
  const email = fbCred.user.email ?? gUser.email ?? '';
  const photoURL = fbCred.user.photoURL ?? gUser.photo ?? undefined;

  await secureStorage.setToken(uid, accessToken);
  await secureStorage.setTokenExpiry(uid, Date.now() + TOKEN_LIFETIME_MS);
  await secureStorage.setActiveUid(uid);

  const accounts = await secureStorage.getAccounts();
  const existing = accounts.find((a) => a.uid === uid);
  const entry: StoredAccount = {
    uid,
    name,
    email,
    photoURL,
    sheetId: existing?.sheetId ?? '',
    lastUsedAt: nowIso(),
  };
  const nextAccounts = existing
    ? accounts.map((a) => (a.uid === uid ? entry : a))
    : [...accounts, entry];
  await secureStorage.setAccounts(nextAccounts);

  return {
    user: { uid, name, email, photoURL },
    accessToken,
    idToken,
    isNewAccount: !existing || !existing.sheetId,
  };
};

let inFlightRefresh: Promise<string> | null = null;

export const getFreshAccessToken = async (uid: string): Promise<string> => {
  const cached = await secureStorage.getToken(uid);
  const expiry = await secureStorage.getTokenExpiry(uid);
  if (cached && expiry && Date.now() < expiry - REFRESH_BUFFER_MS) {
    return cached;
  }

  if (inFlightRefresh) return inFlightRefresh;

  inFlightRefresh = (async () => {
    try {
      configureGoogleSignIn();
      const { accessToken } = await GoogleSignin.getTokens();
      await secureStorage.setToken(uid, accessToken);
      await secureStorage.setTokenExpiry(uid, Date.now() + TOKEN_LIFETIME_MS);
      return accessToken;
    } finally {
      inFlightRefresh = null;
    }
  })();

  return inFlightRefresh;
};

export const signOutCurrent = async (): Promise<void> => {
  try {
    await GoogleSignin.signOut();
  } catch {}
  try {
    await firebaseSignOut(firebaseAuth);
  } catch {}
  await secureStorage.clearActiveUid();
};

export const isCancelledError = (err: unknown): boolean => {
  const code = (err as { code?: string })?.code;
  return code === statusCodes.SIGN_IN_CANCELLED;
};
