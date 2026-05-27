import { useMemo } from 'react';
import { useAuth } from './useAuth';
import { listSalary } from '../services/sheets/salaryService';
import { listAllAllocations } from '../services/sheets/allocationsService';
import { listSpends } from '../services/sheets/walletService';
import { listAllFixedPayments } from '../services/sheets/fixedService';
import { listIncome } from '../services/sheets/incomeService';

export const useSheets = () => {
  const { user, sheetId } = useAuth();

  return useMemo(() => {
    const ready = Boolean(user && sheetId);
    const requireReady = () => {
      if (!user || !sheetId) {
        throw new Error('useSheets called before auth is ready');
      }
      return { uid: user.uid, sheetId };
    };

    return {
      ready,
      listSalary: () => {
        const { uid, sheetId } = requireReady();
        return listSalary(uid, sheetId);
      },
      listAllAllocations: () => {
        const { uid, sheetId } = requireReady();
        return listAllAllocations(uid, sheetId);
      },
      listSpendsAll: () => {
        const { uid, sheetId } = requireReady();
        return listSpends(uid, sheetId);
      },
      listSpendsForMonth: (month: string, year: number) => {
        const { uid, sheetId } = requireReady();
        return listSpends(uid, sheetId, month, year);
      },
      listAllFixed: () => {
        const { uid, sheetId } = requireReady();
        return listAllFixedPayments(uid, sheetId);
      },
      listIncomeAll: () => {
        const { uid, sheetId } = requireReady();
        return listIncome(uid, sheetId);
      },
      listIncomeForMonth: (month: string, year: number) => {
        const { uid, sheetId } = requireReady();
        return listIncome(uid, sheetId, month, year);
      },
    };
  }, [user, sheetId]);
};
