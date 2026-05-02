import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../constants/colors';
import { ProgressDots } from '../../../components/ui/ProgressDots';
import { useSetup } from '../../../context/SetupContext';
import { useAuth } from '../../../hooks/useAuth';
import { ensureUserSheet } from '../../../services/sheets/sheetsSetup';
import { secureStorage } from '../../../services/storage/secureStorage';
import {
  setPin as persistPin,
  setBiometricEnabled as persistBiometric,
} from '../../../services/auth/pinAuth';
import { TABS } from '../../../constants/sheetConfig';

type Phase = 'working' | 'ready' | 'error';

const TAB_LABELS: Array<{ key: string; label: string }> = [
  { key: TABS.salary, label: 'Salary' },
  { key: TABS.allocations, label: 'Allocations' },
  { key: TABS.dailyWallet, label: 'Daily Wallet' },
  { key: TABS.fixedPayments, label: 'Fixed Payments' },
];

export default function Step4() {
  const setup = useSetup();
  const { user, setSheetId, markPinConfigured, refreshAccounts } = useAuth();
  const [phase, setPhase] = useState<Phase>('working');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (!user || !setup.pin) {
      setErrorMsg('Missing user or PIN. Restart setup.');
      setPhase('error');
      return;
    }
    setPhase('working');
    setErrorMsg(null);
    try {
      await persistPin(user.uid, setup.pin);
      await persistBiometric(user.uid, setup.biometricEnabled);
      await secureStorage.setSalaryDay(user.uid, setup.salaryDay);
      await secureStorage.setCurrency(user.uid, setup.currency);
      await secureStorage.setBuckets(user.uid, setup.buckets);

      const res = await ensureUserSheet(user.uid, setup.name);
      await setSheetId(res.sheetId);
      await refreshAccounts();
      setPhase('ready');
    } catch (err) {
      console.log('[step4] setup failed:', err);
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setErrorMsg(msg);
      setPhase('error');
    }
  }, [user, setup, setSheetId, refreshAccounts]);

  useEffect(() => {
    void run();
  }, [run]);

  const start = () => {
    markPinConfigured();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ProgressDots current={4} total={4} />
      <View style={styles.container}>
        {phase === 'working' ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.blue} />
            <Text style={styles.workingText}>
              Creating your sheet in Google Drive…
            </Text>
          </View>
        ) : null}

        {phase === 'ready' ? (
          <>
            <View style={styles.successCard}>
              <View style={styles.iconCircle}>
                <Ionicons name="checkmark" size={32} color={colors.white} />
              </View>
              <Text style={styles.successTitle}>You're all set</Text>
              <Text style={styles.successSub}>
                "Expense Manager — {setup.name}" is live in your Drive.
              </Text>
            </View>

            <View style={styles.tabList}>
              {TAB_LABELS.map((t) => (
                <View key={t.key} style={styles.tabRow}>
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color={colors.green}
                  />
                  <Text style={styles.tabLabel}>{t.label}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {phase === 'error' ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={28} color={colors.red} />
            <Text style={styles.errorTitle}>Couldn't finish setup</Text>
            <Text style={styles.errorMsg}>{errorMsg}</Text>
            <Pressable
              onPress={() => void run()}
              style={[styles.primaryBtn, { marginTop: 16 }]}
            >
              <Text style={styles.primaryBtnText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {phase === 'ready' ? (
        <View style={styles.footer}>
          <Pressable onPress={start} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Start using the app →</Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  container: { flex: 1, padding: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  workingText: { marginTop: 16, color: colors.gray, fontSize: 14 },
  successCard: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: colors.greenLight,
    borderRadius: 16,
    marginTop: 24,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  successTitle: { fontSize: 20, fontWeight: '800', color: colors.greenDark },
  successSub: {
    fontSize: 13,
    color: colors.greenDark,
    opacity: 0.7,
    marginTop: 4,
    textAlign: 'center',
  },
  tabList: { marginTop: 24, gap: 10 },
  tabRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tabLabel: { fontSize: 14, color: colors.gray, fontWeight: '600' },
  errorBox: { alignItems: 'center', padding: 24, marginTop: 32 },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.red,
    marginTop: 8,
  },
  errorMsg: {
    fontSize: 13,
    color: colors.gray,
    textAlign: 'center',
    marginTop: 6,
  },
  footer: { padding: 20 },
  primaryBtn: {
    backgroundColor: colors.blue,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
