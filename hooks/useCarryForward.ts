import { useEffect, useState } from 'react';
import { listAllocations } from '../services/sheets/allocationsService';
import { listSpends, totalSpentForMonth } from '../services/sheets/walletService';
import { computeCarryForward } from '../utils/carryForward';
import { previousMonth } from '../utils/dateHelpers';
import { useAuth } from './useAuth';

interface UseCarryForwardResult {
  amount: number;
  fromMonth: string;
  fromYear: number;
  loading: boolean;
}

export const useCarryForward = (
  month: string,
  year: number,
): UseCarryForwardResult => {
  const { user, sheetId } = useAuth();
  const prev = previousMonth(month, year);
  const [amount, setAmount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || !sheetId) {
      setAmount(0);
      return;
    }
    let mounted = true;
    setLoading(true);
    (async () => {
      try {
        const [allocs, spends] = await Promise.all([
          listAllocations(user.uid, sheetId, prev.month, prev.year),
          listSpends(user.uid, sheetId, prev.month, prev.year),
        ]);
        const wallet = allocs.find((a) => a.bucketType === 'wallet');
        const cf = wallet
          ? computeCarryForward(wallet.allocatedAmount, totalSpentForMonth(spends))
          : 0;
        if (mounted) setAmount(cf);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user, sheetId, prev.month, prev.year]);

  return { amount, fromMonth: prev.month, fromYear: prev.year, loading };
};
