import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';
import { Alert } from 'react-native';
import { AxiosError } from 'axios';
import { monthName, year as yearOf, previousMonth } from '../utils/dateHelpers';
import { computeCarryForward } from '../utils/carryForward';
import { fetchTabGids } from '../services/sheets/sheetsSetup';
import { getSalaryFor } from '../services/sheets/salaryService';
import {
  listAllocations,
  saveAllocations as svcSaveAllocations,
} from '../services/sheets/allocationsService';
import {
  listSpends,
  addSpend as svcAddSpend,
  removeSpend as svcRemoveSpend,
  totalSpentForMonth,
} from '../services/sheets/walletService';
import {
  listFixedPayments,
  addFixedPayment as svcAddFixedPayment,
  removeFixedPayment as svcRemoveFixedPayment,
} from '../services/sheets/fixedService';
import {
  listPurposes,
  addPurpose as svcAddPurpose,
} from '../services/sheets/purposesService';
import { TABS, type TabName } from '../constants/sheetConfig';
import type {
  MonthData,
  Allocation,
  WalletSpend,
  FixedPayment,
  Purpose,
} from '../types';
import { useAuthContext } from './AuthContext';

interface State {
  loading: boolean;
  month: string;
  year: number;
  salary: MonthData | null;
  allocations: Allocation[];
  spends: WalletSpend[];
  fixedPayments: FixedPayment[];
  purposes: Purpose[];
  carryForward: number;
  tabGids: Record<TabName, number> | null;
}

type Action =
  | { type: 'loading'; loading: boolean }
  | { type: 'month'; month: string; year: number }
  | { type: 'hydrate'; payload: Partial<State> }
  | { type: 'spend-added'; spend: WalletSpend }
  | { type: 'spend-removed'; id: string }
  | { type: 'fixed-added'; payment: FixedPayment }
  | { type: 'fixed-removed'; id: string }
  | { type: 'purpose-added'; purpose: Purpose };

const todayMonth = monthName();
const todayYear = yearOf();

const initialState: State = {
  loading: false,
  month: todayMonth,
  year: todayYear,
  salary: null,
  allocations: [],
  spends: [],
  fixedPayments: [],
  purposes: [],
  carryForward: 0,
  tabGids: null,
};

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'loading':
      return { ...state, loading: action.loading };
    case 'month':
      return { ...state, month: action.month, year: action.year };
    case 'hydrate':
      return { ...state, ...action.payload, loading: false };
    case 'spend-added':
      return { ...state, spends: [action.spend, ...state.spends] };
    case 'spend-removed':
      return { ...state, spends: state.spends.filter((s) => s.id !== action.id) };
    case 'fixed-added':
      return {
        ...state,
        fixedPayments: [...state.fixedPayments, action.payment],
      };
    case 'fixed-removed':
      return {
        ...state,
        fixedPayments: state.fixedPayments.filter((p) => p.id !== action.id),
      };
    case 'purpose-added':
      return state.purposes.some(
        (p) => p.name.toLowerCase() === action.purpose.name.toLowerCase(),
      )
        ? state
        : { ...state, purposes: [...state.purposes, action.purpose] };
    default:
      return state;
  }
};

interface DataContextValue extends State {
  setActiveMonth: (month: string, year: number) => void;
  refresh: () => Promise<void>;
  addSpend: (spend: Omit<WalletSpend, 'id' | 'balanceAfter'>) => Promise<void>;
  removeSpend: (id: string) => Promise<void>;
  saveAllocationsForMonth: (list: Allocation[]) => Promise<void>;
  addFixedPayment: (payment: Omit<FixedPayment, 'id'>) => Promise<void>;
  removeFixedPayment: (id: string) => Promise<void>;
  addPurpose: (name: string) => Promise<void>;
  walletBucket: Allocation | undefined;
  walletBudget: number;
  walletSpent: number;
  walletRemaining: number;
}

const DataContext = createContext<DataContextValue | null>(null);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, sheetId, status, clearSheet } = useAuthContext();
  const [state, dispatch] = useReducer(reducer, initialState);

  const hydrateFor = useCallback(
    async (uid: string, sid: string, month: string, year: number) => {
      dispatch({ type: 'loading', loading: true });
      try {
        const [salary, allocations, spends, fixedPayments, purposes] =
          await Promise.all([
            getSalaryFor(uid, sid, month, year),
            listAllocations(uid, sid, month, year),
            listSpends(uid, sid, month, year),
            listFixedPayments(uid, sid, month, year),
            listPurposes(uid, sid),
          ]);

        const prev = previousMonth(month, year);
        const prevAllocs = await listAllocations(uid, sid, prev.month, prev.year);
        const prevSpends = await listSpends(uid, sid, prev.month, prev.year);
        const prevWallet = prevAllocs.find((a) => a.bucketType === 'wallet');
        const prevWalletSpent = totalSpentForMonth(prevSpends);
        const carryForward = prevWallet
          ? computeCarryForward(prevWallet.allocatedAmount, prevWalletSpent)
          : 0;

        const tabGids = state.tabGids ?? (await fetchTabGids(uid, sid));

        dispatch({
          type: 'hydrate',
          payload: {
            salary,
            allocations,
            spends,
            fixedPayments,
            purposes,
            carryForward,
            tabGids,
          },
        });
      } catch (err) {
        dispatch({ type: 'loading', loading: false });
        const ax = err as AxiosError;
        if (ax?.response?.status === 404) {
          await clearSheet();
          Alert.alert(
            'Sheet not found',
            'Your Google Sheet was deleted or is no longer accessible. Let\u2019s set up a new one.',
          );
          return;
        }
        throw err;
      }
    },
    [state.tabGids, clearSheet],
  );

  useEffect(() => {
    if (status !== 'authenticated' || !user || !sheetId) return;
    void hydrateFor(user.uid, sheetId, state.month, state.year);
  }, [status, user, sheetId, state.month, state.year, hydrateFor]);

  const setActiveMonth = useCallback((month: string, year: number) => {
    dispatch({ type: 'month', month, year });
  }, []);

  const refresh = useCallback(async () => {
    if (!user || !sheetId) return;
    await hydrateFor(user.uid, sheetId, state.month, state.year);
  }, [user, sheetId, state.month, state.year, hydrateFor]);

  const walletBucket = useMemo(
    () => state.allocations.find((a) => a.bucketType === 'wallet'),
    [state.allocations],
  );
  const walletBudget = (walletBucket?.allocatedAmount ?? 0) + state.carryForward;
  const walletSpent = useMemo(
    () => totalSpentForMonth(state.spends),
    [state.spends],
  );
  const walletRemaining = walletBudget - walletSpent;

  const addSpend = useCallback(
    async (spend: Omit<WalletSpend, 'id' | 'balanceAfter'>) => {
      if (!user || !sheetId) throw new Error('Not authenticated');
      const balanceAfter = walletRemaining - spend.amount;
      const added = await svcAddSpend(user.uid, sheetId, {
        ...spend,
        balanceAfter,
      });
      dispatch({ type: 'spend-added', spend: added });
    },
    [user, sheetId, walletRemaining],
  );

  const removeSpend = useCallback(
    async (id: string) => {
      if (!user || !sheetId) throw new Error('Not authenticated');
      const gid = state.tabGids?.[TABS.dailyWallet];
      if (gid === undefined) throw new Error('Missing tab gid for Daily Wallet');
      await svcRemoveSpend(user.uid, sheetId, gid, id);
      dispatch({ type: 'spend-removed', id });
      await refresh();
    },
    [user, sheetId, state.tabGids, refresh],
  );

  const saveAllocationsForMonth = useCallback(
    async (list: Allocation[]) => {
      if (!user || !sheetId) throw new Error('Not authenticated');
      const gid = state.tabGids?.[TABS.allocations];
      if (gid === undefined) throw new Error('Missing tab gid for Allocations');
      await svcSaveAllocations(user.uid, sheetId, gid, state.month, state.year, list);
      await refresh();
    },
    [user, sheetId, state.tabGids, state.month, state.year, refresh],
  );

  const addFixedPayment = useCallback(
    async (payment: Omit<FixedPayment, 'id'>) => {
      if (!user || !sheetId) throw new Error('Not authenticated');
      const saved = await svcAddFixedPayment(user.uid, sheetId, payment);
      dispatch({ type: 'fixed-added', payment: saved });
    },
    [user, sheetId],
  );

  const removeFixedPayment = useCallback(
    async (id: string) => {
      if (!user || !sheetId) throw new Error('Not authenticated');
      const gid = state.tabGids?.[TABS.fixedPayments];
      if (gid === undefined) throw new Error('Missing tab gid for Fixed Payments');
      await svcRemoveFixedPayment(user.uid, sheetId, gid, id);
      dispatch({ type: 'fixed-removed', id });
      await refresh();
    },
    [user, sheetId, state.tabGids, refresh],
  );

  const addPurpose = useCallback(
    async (name: string) => {
      if (!user || !sheetId) throw new Error('Not authenticated');
      const added = await svcAddPurpose(user.uid, sheetId, name);
      dispatch({ type: 'purpose-added', purpose: added });
    },
    [user, sheetId],
  );

  const value = useMemo<DataContextValue>(
    () => ({
      ...state,
      setActiveMonth,
      refresh,
      addSpend,
      removeSpend,
      saveAllocationsForMonth,
      addFixedPayment,
      removeFixedPayment,
      addPurpose,
      walletBucket,
      walletBudget,
      walletSpent,
      walletRemaining,
    }),
    [
      state,
      setActiveMonth,
      refresh,
      addSpend,
      removeSpend,
      saveAllocationsForMonth,
      addFixedPayment,
      removeFixedPayment,
      addPurpose,
      walletBucket,
      walletBudget,
      walletSpent,
      walletRemaining,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useDataContext = (): DataContextValue => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useDataContext must be used within DataProvider');
  return ctx;
};
