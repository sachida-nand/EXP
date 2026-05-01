import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { colors } from '../../constants/colors';
import { BucketRow } from '../../components/ui/BucketRow';
import { AddFixedPaymentModal, type FixedPaymentInput } from '../../components/modals/AddFixedPaymentModal';
import { useAuth } from '../../hooks/useAuth';
import { useDataContext } from '../../context/DataContext';
import { secureStorage } from '../../services/storage/secureStorage';
import { formatCurrency } from '../../utils/formatCurrency';
import { toSheetDate, monthName, year as yearOf } from '../../utils/dateHelpers';
import {
  ensureReceiptsFolder,
  uploadReceiptImage,
} from '../../services/drive/driveReceipts';
import type { Allocation } from '../../types';

type BucketStatus = 'paid' | 'given' | 'pending' | 'partial';

export default function FixedScreen() {
  const { user } = useAuth();
  const {
    month,
    year,
    allocations,
    fixedPayments,
    loading,
    refresh,
    addFixedPayment,
    removeFixedPayment,
  } = useDataContext();

  const [currency, setCurrency] = useState('₹');
  const [active, setActive] = useState<Allocation | null>(null);
  const [bucketIcons, setBucketIcons] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    void secureStorage.getCurrency(user.uid).then((c) => c && setCurrency(c));
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      void secureStorage.getBuckets(user.uid).then((bs) => {
        if (!bs) return;
        const map: Record<string, string> = {};
        for (const b of bs) map[b.name] = b.icon;
        setBucketIcons(map);
      });
    }, [user]),
  );

  const fixed = useMemo(
    () => allocations.filter((a) => a.bucketType !== 'wallet'),
    [allocations],
  );

  const paidByBucket = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of fixedPayments) {
      map[p.bucketName] = (map[p.bucketName] ?? 0) + p.amount;
    }
    return map;
  }, [fixedPayments]);

  const historyForActive = useMemo(() => {
    if (!active) return [];
    return fixedPayments
      .filter((p) => p.bucketName === active.bucketName)
      .sort((a, b) => (a.datePaid < b.datePaid ? 1 : -1));
  }, [fixedPayments, active]);

  const totalPaid = fixedPayments.reduce((s, p) => s + p.amount, 0);
  const settledCount = fixed.filter(
    (a) => (paidByBucket[a.bucketName] ?? 0) >= a.allocatedAmount,
  ).length;

  const statusFor = (a: Allocation): BucketStatus => {
    const paid = paidByBucket[a.bucketName] ?? 0;
    if (paid <= 0) return 'pending';
    if (paid < a.allocatedAmount) return 'partial';
    return a.bucketType === 'give' ? 'given' : 'paid';
  };

  const subtitleFor = (a: Allocation): string => {
    const paid = paidByBucket[a.bucketName] ?? 0;
    if (paid <= 0) {
      return a.bucketType === 'give' ? 'Transfer to person' : 'Fixed payment';
    }
    return `${formatCurrency(paid, currency)} of ${formatCurrency(a.allocatedAmount, currency)}`;
  };

  const onRecord = async ({
    amount,
    paidTo,
    notes,
    date,
    image,
  }: FixedPaymentInput) => {
    if (!active || !user) return;
    const payMonth = monthName(date);
    const payYear = yearOf(date);
    try {
      let receiptLink = '';
      if (image) {
        const folderId = await ensureReceiptsFolder(user.uid, user.name);
        const stamp = `${payMonth}-${payYear}-${active.bucketName}-${Date.now()}`;
        const safeStamp = stamp.replace(/[^\w.-]+/g, '_');
        const ext = image.fileName.includes('.')
          ? image.fileName.slice(image.fileName.lastIndexOf('.'))
          : '.jpg';
        const finalName = `${safeStamp}${ext}`;
        receiptLink = await uploadReceiptImage(
          user.uid,
          folderId,
          image.uri,
          finalName,
          image.mimeType,
        );
      }
      await addFixedPayment({
        month: payMonth,
        year: payYear,
        bucketName: active.bucketName,
        paymentType: active.bucketType === 'give' ? 'given' : 'paid',
        amount,
        paidTo,
        datePaid: toSheetDate(date),
        receiptLink,
        notes,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed';
      Alert.alert('Could not save payment', msg);
      throw err;
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} />
        }
      >
        <View style={styles.pill}>
          <Text style={styles.pillText}>
            {month} {year} · {settledCount} of {fixed.length} settled ·{' '}
            {formatCurrency(totalPaid, currency)} paid
          </Text>
        </View>

        {fixed.length === 0 ? (
          <Text style={styles.empty}>
            No fixed buckets. Add them in Salary.
          </Text>
        ) : (
          fixed.map((a) => (
            <BucketRow
              key={a.bucketName}
              icon={bucketIcons[a.bucketName] ?? (a.bucketType === 'give' ? '💸' : '🏠')}
              name={a.bucketName}
              amount={a.allocatedAmount}
              subtitle={subtitleFor(a)}
              status={statusFor(a)}
              currency={currency}
              onPress={() => setActive(a)}
            />
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <AddFixedPaymentModal
        visible={active !== null}
        onClose={() => setActive(null)}
        onSubmit={onRecord}
        onDeletePayment={removeFixedPayment}
        bucketName={active?.bucketName ?? ''}
        bucketType={active?.bucketType ?? ''}
        allocated={active?.allocatedAmount ?? 0}
        totalPaid={active ? paidByBucket[active.bucketName] ?? 0 : 0}
        history={historyForActive}
        currency={currency}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  scroll: { padding: 16 },
  pill: {
    backgroundColor: colors.purpleLight,
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
  },
  pillText: {
    color: colors.purpleDark,
    fontWeight: '700',
    fontSize: 13,
  },
  empty: {
    textAlign: 'center',
    fontSize: 13,
    color: colors.gray,
    opacity: 0.6,
    marginTop: 20,
  },
});
