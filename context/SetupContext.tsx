import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import type { Bucket } from '../types';
import { defaultBuckets } from '../constants/defaultBuckets';

interface SetupDraft {
  name: string;
  salaryDay: number;
  currency: string;
  buckets: Bucket[];
  pin: string | null;
  biometricEnabled: boolean;
}

interface SetupContextValue extends SetupDraft {
  setName: (v: string) => void;
  setSalaryDay: (v: number) => void;
  setCurrency: (v: string) => void;
  setBuckets: (v: Bucket[]) => void;
  toggleBucket: (bucket: Bucket) => void;
  setPin: (v: string | null) => void;
  setBiometricEnabled: (v: boolean) => void;
}

const SetupContext = createContext<SetupContextValue | null>(null);

export const SetupProvider: React.FC<{
  children: React.ReactNode;
  initialName?: string;
}> = ({ children, initialName = '' }) => {
  const [name, setName] = useState(initialName);
  const [salaryDay, setSalaryDay] = useState(1);
  const [currency, setCurrency] = useState('₹');
  const [buckets, setBuckets] = useState<Bucket[]>(defaultBuckets);
  const [pin, setPin] = useState<string | null>(null);
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  const toggleBucket = useCallback((bucket: Bucket) => {
    setBuckets((prev) => {
      if (bucket.isWallet) return prev;
      const exists = prev.some((b) => b.id === bucket.id);
      return exists
        ? prev.filter((b) => b.id !== bucket.id)
        : [...prev, bucket];
    });
  }, []);

  const value = useMemo<SetupContextValue>(
    () => ({
      name,
      salaryDay,
      currency,
      buckets,
      pin,
      biometricEnabled,
      setName,
      setSalaryDay,
      setCurrency,
      setBuckets,
      toggleBucket,
      setPin,
      setBiometricEnabled,
    }),
    [name, salaryDay, currency, buckets, pin, biometricEnabled, toggleBucket],
  );

  return <SetupContext.Provider value={value}>{children}</SetupContext.Provider>;
};

export const useSetup = (): SetupContextValue => {
  const ctx = useContext(SetupContext);
  if (!ctx) throw new Error('useSetup must be used within SetupProvider');
  return ctx;
};
