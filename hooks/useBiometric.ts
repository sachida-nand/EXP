import { useCallback, useEffect, useState } from 'react';
import {
  getBiometricCapability,
  isBiometricEnabled,
  setBiometricEnabled,
  authenticateWithBiometric,
  type BiometricCapability,
} from '../services/auth/pinAuth';
import { useAuth } from './useAuth';

interface UseBiometricResult {
  capability: BiometricCapability | null;
  enabled: boolean;
  usable: boolean;
  authenticate: (promptMessage?: string) => Promise<boolean>;
  setEnabled: (next: boolean) => Promise<void>;
}

export const useBiometric = (): UseBiometricResult => {
  const { user } = useAuth();
  const [capability, setCapability] = useState<BiometricCapability | null>(null);
  const [enabled, setEnabledState] = useState(false);

  useEffect(() => {
    let mounted = true;
    getBiometricCapability().then((c) => {
      if (mounted) setCapability(c);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setEnabledState(false);
      return;
    }
    let mounted = true;
    isBiometricEnabled(user.uid).then((e) => {
      if (mounted) setEnabledState(e);
    });
    return () => {
      mounted = false;
    };
  }, [user]);

  const authenticate = useCallback(
    (promptMessage?: string) => authenticateWithBiometric(promptMessage),
    [],
  );

  const setEnabled = useCallback(
    async (next: boolean) => {
      if (!user) return;
      await setBiometricEnabled(user.uid, next);
      setEnabledState(next);
    },
    [user],
  );

  const usable = Boolean(
    capability?.hardwareAvailable && capability?.enrolled,
  );

  return { capability, enabled, usable, authenticate, setEnabled };
};
