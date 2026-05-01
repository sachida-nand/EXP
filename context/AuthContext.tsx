import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';
import { signInWithGoogle, signOutCurrent, type GoogleUser } from '../services/auth/googleAuth';
import { hasPin } from '../services/auth/pinAuth';
import { secureStorage } from '../services/storage/secureStorage';
import { nowIso } from '../utils/dateHelpers';
import type { StoredAccount } from '../types';

type Status = 'loading' | 'unauthenticated' | 'setup' | 'locked' | 'authenticated';

interface State {
  status: Status;
  user: GoogleUser | null;
  sheetId: string | null;
  accounts: StoredAccount[];
}

type Action =
  | { type: 'hydrated'; user: GoogleUser | null; sheetId: string | null; pinSet: boolean; accounts: StoredAccount[] }
  | { type: 'signed-in'; user: GoogleUser; sheetId: string | null; pinSet: boolean; accounts: StoredAccount[] }
  | { type: 'signed-out'; accounts: StoredAccount[] }
  | { type: 'unlocked' }
  | { type: 'lock' }
  | { type: 'sheet-ready'; sheetId: string }
  | { type: 'sheet-missing' }
  | { type: 'pin-configured' }
  | { type: 'accounts-updated'; accounts: StoredAccount[] };

const initialState: State = {
  status: 'loading',
  user: null,
  sheetId: null,
  accounts: [],
};

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'hydrated': {
      if (!action.user) return { ...state, status: 'unauthenticated', accounts: action.accounts };
      if (!action.sheetId || !action.pinSet) {
        return { ...state, status: 'setup', user: action.user, sheetId: action.sheetId, accounts: action.accounts };
      }
      return { ...state, status: 'locked', user: action.user, sheetId: action.sheetId, accounts: action.accounts };
    }
    case 'signed-in': {
      const status: Status = !action.sheetId || !action.pinSet ? 'setup' : 'authenticated';
      return { ...state, status, user: action.user, sheetId: action.sheetId, accounts: action.accounts };
    }
    case 'signed-out':
      return { ...state, status: 'unauthenticated', user: null, sheetId: null, accounts: action.accounts };
    case 'unlocked':
      return { ...state, status: 'authenticated' };
    case 'lock':
      return state.user ? { ...state, status: 'locked' } : state;
    case 'sheet-ready':
      return { ...state, sheetId: action.sheetId };
    case 'sheet-missing':
      return state.user
        ? { ...state, sheetId: null, status: 'setup' }
        : state;
    case 'pin-configured':
      return state.sheetId ? { ...state, status: 'authenticated' } : state;
    case 'accounts-updated':
      return { ...state, accounts: action.accounts };
    default:
      return state;
  }
};

interface AuthContextValue {
  status: Status;
  user: GoogleUser | null;
  sheetId: string | null;
  accounts: StoredAccount[];
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  switchUser: (uid: string) => Promise<void>;
  unlock: () => void;
  lock: () => void;
  setSheetId: (sheetId: string) => Promise<void>;
  clearSheet: () => Promise<void>;
  markPinConfigured: () => void;
  refreshAccounts: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const loadUserByUid = async (
  uid: string,
): Promise<{ user: GoogleUser | null; sheetId: string | null; pinSet: boolean }> => {
  const accounts = await secureStorage.getAccounts();
  const acct = accounts.find((a) => a.uid === uid);
  if (!acct) return { user: null, sheetId: null, pinSet: false };
  const sheetId = (await secureStorage.getSheetId(uid)) ?? null;
  const pinSet = await hasPin(uid);
  return {
    user: {
      uid: acct.uid,
      name: acct.name,
      email: acct.email,
      photoURL: acct.photoURL,
    },
    sheetId,
    pinSet,
  };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    (async () => {
      const accounts = await secureStorage.getAccounts();
      const activeUid = await secureStorage.getActiveUid();
      if (!activeUid) {
        dispatch({ type: 'hydrated', user: null, sheetId: null, pinSet: false, accounts });
        return;
      }
      const { user, sheetId, pinSet } = await loadUserByUid(activeUid);
      dispatch({ type: 'hydrated', user, sheetId, pinSet, accounts });
    })();
  }, []);

  const signIn = useCallback(async () => {
    const result = await signInWithGoogle();
    const pinSet = await hasPin(result.user.uid);
    const sheetId = (await secureStorage.getSheetId(result.user.uid)) ?? null;
    const accounts = await secureStorage.getAccounts();
    dispatch({ type: 'signed-in', user: result.user, sheetId, pinSet, accounts });
  }, []);

  const signOut = useCallback(async () => {
    await signOutCurrent();
    const accounts = await secureStorage.getAccounts();
    dispatch({ type: 'signed-out', accounts });
  }, []);

  const switchUser = useCallback(async (uid: string) => {
    await secureStorage.setActiveUid(uid);
    const accounts = await secureStorage.getAccounts();
    const next = accounts.map((a) =>
      a.uid === uid ? { ...a, lastUsedAt: nowIso() } : a,
    );
    await secureStorage.setAccounts(next);
    const { user, sheetId, pinSet } = await loadUserByUid(uid);
    dispatch({ type: 'hydrated', user, sheetId, pinSet, accounts: next });
  }, []);

  const unlock = useCallback(() => dispatch({ type: 'unlocked' }), []);
  const lock = useCallback(() => dispatch({ type: 'lock' }), []);

  const setSheetId = useCallback(async (sheetId: string) => {
    if (state.user) {
      await secureStorage.setSheetId(state.user.uid, sheetId);
    }
    dispatch({ type: 'sheet-ready', sheetId });
  }, [state.user]);

  const clearSheet = useCallback(async () => {
    if (state.user) {
      await secureStorage.setSheetId(state.user.uid, '');
    }
    dispatch({ type: 'sheet-missing' });
  }, [state.user]);

  const markPinConfigured = useCallback(
    () => dispatch({ type: 'pin-configured' }),
    [],
  );

  const refreshAccounts = useCallback(async () => {
    const accounts = await secureStorage.getAccounts();
    dispatch({ type: 'accounts-updated', accounts });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status: state.status,
      user: state.user,
      sheetId: state.sheetId,
      accounts: state.accounts,
      signIn,
      signOut,
      switchUser,
      unlock,
      lock,
      setSheetId,
      clearSheet,
      markPinConfigured,
      refreshAccounts,
    }),
    [state, signIn, signOut, switchUser, unlock, lock, setSheetId, clearSheet, markPinConfigured, refreshAccounts],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
};
