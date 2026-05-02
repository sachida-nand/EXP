import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { colors } from '../../constants/colors';
import { HeroCard, ProgressBar } from '../../components/ui/HeroCard';
import { StatCard } from '../../components/ui/StatCard';
import { BucketRow } from '../../components/ui/BucketRow';
import { AddSpendModal } from '../../components/modals/AddSpendModal';
import { useAuth } from '../../hooks/useAuth';
import { useDataContext } from '../../context/DataContext';
import { formatCurrency, formatSigned } from '../../utils/formatCurrency';
import { toSheetDate, monthName, year as yearOf } from '../../utils/dateHelpers';
import { secureStorage } from '../../services/storage/secureStorage';
import {
  ensureReceiptsFolder,
  uploadReceiptImage,
} from '../../services/drive/driveReceipts';

export default function Dashboard() {
  const { user } = useAuth();
  const {
    month,
    year,
    salary,
    allocations,
    fixedPayments,
    spends,
    carryForward,
    walletBudget,
    walletSpent,
    walletRemaining,
    loading,
    refresh,
    addSpend,
  } = useDataContext();

  const [currency, setCurrency] = useState('₹');
  const [hideAmounts, setHideAmounts] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [paidToRecents, setPaidToRecents] = useState<string[]>([]);
  const [bucketIcons, setBucketIcons] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    void secureStorage.getCurrency(user.uid).then((c) => {
      if (c) setCurrency(c);
    });
    void secureStorage.getPaidToRecents(user.uid).then(setPaidToRecents);
    void secureStorage.getBuckets(user.uid).then((bs) => {
      if (!bs) return;
      const map: Record<string, string> = {};
      for (const b of bs) map[b.name] = b.icon;
      setBucketIcons(map);
    });
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      setHideAmounts(true);
      if (user) {
        void secureStorage.getBuckets(user.uid).then((bs) => {
          if (!bs) return;
          const map: Record<string, string> = {};
          for (const b of bs) map[b.name] = b.icon;
          setBucketIcons(map);
        });
      }
    }, [user]),
  );

  const onRefresh = useCallback(() => {
    setHideAmounts(true);
    refresh();
  }, [refresh]);

  const paidToSuggestions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of paidToRecents) {
      if (r.trim()) map.set(r.toLowerCase(), r);
    }
    for (const s of spends) {
      if (s.paidTo.trim() && !map.has(s.paidTo.toLowerCase())) {
        map.set(s.paidTo.toLowerCase(), s.paidTo);
      }
    }
    return Array.from(map.values());
  }, [paidToRecents, spends]);

  const handleAddSpend = async ({
    amount,
    paidTo,
    notes,
    date,
    deductsWallet,
    image,
  }: {
    amount: number;
    paidTo: string;
    notes: string;
    date: Date;
    deductsWallet: boolean;
    image?: { uri: string; mimeType: string; fileName: string };
  }) => {
    if (!user) return;
    const spendMonth = monthName(date);
    const spendYear = yearOf(date);
    try {
      let receiptLink = '';
      if (image) {
        const folderId = await ensureReceiptsFolder(user.uid, user.name);
        const stamp = `${spendMonth}-${spendYear}-wallet-${Date.now()}`;
        const safeStamp = stamp.replace(/[^\w.-]+/g, '_');
        const ext = image.fileName.includes('.')
          ? image.fileName.slice(image.fileName.lastIndexOf('.'))
          : '.jpg';
        receiptLink = await uploadReceiptImage(
          user.uid,
          folderId,
          image.uri,
          `${safeStamp}${ext}`,
          image.mimeType,
        );
      }
      await addSpend({
        date: toSheetDate(date),
        month: spendMonth,
        year: spendYear,
        amount,
        paidTo,
        notes,
        receiptLink,
        deductsWallet,
      });
      if (paidTo.trim()) {
        await secureStorage.addPaidToRecent(user.uid, paidTo.trim());
        const updated = await secureStorage.getPaidToRecents(user.uid);
        setPaidToRecents(updated);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to add spend';
      Alert.alert('Could not add spend', msg);
      throw err;
    }
  };

  const toggleHideAmounts = () => {
    setHideAmounts((v) => !v);
  };

  const maskedAmount = (v: number): string =>
    hideAmounts ? `${currency} xxx` : formatCurrency(v, currency);
  const maskedSigned = (v: number): string =>
    hideAmounts ? `${currency} xxx` : formatSigned(v, currency);

  const allocated = allocations.reduce((s, a) => s + a.allocatedAmount, 0);
  const salaryAmount = salary?.salaryAmount ?? 0;
  const fixedPaid = fixedPayments.reduce((s, p) => s + p.amount, 0);
  const netSavings = salaryAmount + carryForward - allocated;

  const fixedBuckets = allocations.filter((a) => a.bucketType !== 'wallet');

  const firstName = user?.name?.trim().split(/\s+/)[0] ?? '';
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const paidByBucket: Record<string, number> = {};
  for (const p of fixedPayments) {
    paidByBucket[p.bucketName] = (paidByBucket[p.bucketName] ?? 0) + p.amount;
  }

  const statusFor = (
    bucketName: string,
    bucketType: string,
    allocated: number,
  ): 'paid' | 'given' | 'pending' | 'partial' => {
    const paid = paidByBucket[bucketName] ?? 0;
    if (paid <= 0) return 'pending';
    if (paid < allocated) return 'partial';
    return bucketType === 'give' ? 'given' : 'paid';
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={onRefresh} />
        }
      >
        <View style={styles.topBar}>
          <Text style={styles.greeting}>
            {greeting}
            {firstName ? `, ${firstName}` : ''}
          </Text>
          <Text style={styles.topBarText}>
            {month} {year}
          </Text>
        </View>

        <HeroCard backgroundColor={colors.blue}>
          <View style={styles.heroHeader}>
            <Text style={styles.heroLabel}>Salary this month</Text>
            <Pressable
              onPress={toggleHideAmounts}
              hitSlop={10}
              style={styles.eyeBtn}
            >
              <Ionicons
                name={hideAmounts ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color={colors.white}
              />
            </Pressable>
          </View>
          <Text style={styles.heroValue}>{maskedAmount(salaryAmount)}</Text>
          {carryForward !== 0 ? (
            <Text style={styles.heroSub}>
              Carry from last month: {maskedSigned(carryForward)}
            </Text>
          ) : null}
        </HeroCard>

        <View style={styles.statGrid}>
          <View style={styles.statRow}>
            <StatCard
              label="Total allocated"
              value={maskedAmount(allocated)}
              bgColor={colors.grayLight}
            />
            <StatCard
              label="Fixed paid"
              value={maskedAmount(fixedPaid)}
              color={colors.greenDark}
              bgColor={colors.greenLight}
            />
          </View>
          <View style={styles.statRow}>
            <StatCard
              label="Wallet left"
              value={maskedAmount(walletRemaining)}
              color={colors.blueDark}
              bgColor={colors.blueLight}
            />
            <StatCard
              label="Net savings"
              value={maskedAmount(netSavings)}
              color={colors.purpleDark}
              bgColor={colors.purpleLight}
            />
          </View>
        </View>

        <HeroCard backgroundColor={colors.green} style={{ marginTop: 8 }}>
          <View style={styles.heroHeader}>
            <Text style={styles.heroLabel}>Remaining balance</Text>
            <Pressable
              onPress={() => setShowAdd(true)}
              style={styles.quickAddBtn}
              hitSlop={6}
            >
              <Ionicons name="add" size={16} color={colors.greenDark} />
              <Text style={styles.quickAddText}>Add spend</Text>
            </Pressable>
          </View>
          <Text style={styles.heroValue}>
            {maskedAmount(walletRemaining)}
          </Text>
          <Text style={styles.heroSub}>
            of {maskedAmount(walletBudget)} budget ·{' '}
            {maskedAmount(walletSpent)} spent
          </Text>
          <ProgressBar value={walletSpent} max={walletBudget} />
        </HeroCard>

        <Text style={styles.section}>Fixed payments</Text>
        {fixedBuckets.length === 0 ? (
          <Text style={styles.empty}>
            No allocations yet. Go to Salary to set budgets.
          </Text>
        ) : (
          fixedBuckets.map((a) => (
            <BucketRow
              key={a.bucketName}
              icon={bucketIcons[a.bucketName] ?? (a.bucketType === 'give' ? '💸' : '🏠')}
              name={a.bucketName}
              amount={a.allocatedAmount}
              status={statusFor(a.bucketName, a.bucketType, a.allocatedAmount)}
              currency={currency}
              subtitle={a.bucketType === 'give' ? 'Transfer' : 'Fixed payment'}
              hideAmount={hideAmounts}
            />
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <AddSpendModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onSubmit={handleAddSpend}
        paidToSuggestions={paidToSuggestions}
        currency={currency}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  scroll: { padding: 16 },
  topBar: { marginBottom: 12 },
  greeting: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.gray,
  },
  topBarText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray,
    opacity: 0.6,
    marginTop: 2,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroLabel: { color: colors.white, opacity: 0.8, fontSize: 13 },
  eyeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  heroValue: {
    color: colors.white,
    fontSize: 32,
    fontWeight: '800',
    marginTop: 4,
  },
  heroSub: { color: colors.white, opacity: 0.8, fontSize: 12, marginTop: 6 },
  quickAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: colors.white,
  },
  quickAddText: { color: colors.greenDark, fontWeight: '700', fontSize: 12 },
  statGrid: { gap: 10 },
  statRow: { flexDirection: 'row', gap: 10 },
  section: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.gray,
    marginTop: 16,
    marginBottom: 8,
  },
  empty: {
    fontSize: 13,
    color: colors.gray,
    opacity: 0.6,
    textAlign: 'center',
    marginTop: 16,
  },
});
