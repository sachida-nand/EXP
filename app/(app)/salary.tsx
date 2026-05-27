import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { AllocationRow } from '../../components/ui/AllocationRow';
import { AddBucketModal } from '../../components/modals/AddBucketModal';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { useDataContext } from '../../context/DataContext';
import { useSheets } from '../../hooks/useSheets';
import { secureStorage } from '../../services/storage/secureStorage';
import { saveSalary } from '../../services/sheets/salaryService';
import { listAllocations } from '../../services/sheets/allocationsService';
import {
  listSpends,
  totalSpentForMonth,
} from '../../services/sheets/walletService';
import { computeCarryForward } from '../../utils/carryForward';
import { formatCurrency, parseCurrency } from '../../utils/formatCurrency';
import { toSheetDate, previousMonth } from '../../utils/dateHelpers';
import type { Bucket, Allocation } from '../../types';

export default function SalaryScreen() {
  const router = useRouter();
  const { user, sheetId } = useAuth();
  const {
    month,
    year,
    salary,
    allocations,
    saveAllocationsForMonth,
    refresh,
    monthIncomeTotal,
  } = useDataContext();
  const sheets = useSheets();

  const [currency, setCurrency] = useState('₹');
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [salaryAmount, setSalaryAmount] = useState('');
  const [source, setSource] = useState('');
  const [lastMonthMap, setLastMonthMap] = useState<Record<string, number>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    void secureStorage.getCurrency(user.uid).then((c) => c && setCurrency(c));
    void secureStorage.getBuckets(user.uid).then((b) => {
      if (b) setBuckets(b);
    });
  }, [user]);

  useEffect(() => {
    setSalaryAmount(salary?.salaryAmount ? String(salary.salaryAmount) : '');
    setSource(salary?.source ?? '');
  }, [salary]);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const a of allocations) {
      next[a.bucketName] = String(a.allocatedAmount || '');
    }
    setAmounts(next);
  }, [allocations]);

  useEffect(() => {
    if (!sheets.ready) return;
    const prev = previousMonth(month, year);
    (async () => {
      const all = await sheets.listAllAllocations();
      const map: Record<string, number> = {};
      for (const a of all) {
        if (a.month === prev.month && a.year === prev.year) {
          map[a.bucketName] = a.allocatedAmount;
        }
      }
      setLastMonthMap(map);
    })();
  }, [sheets, month, year]);

  const totalAllocated = useMemo(
    () =>
      Object.values(amounts).reduce((s, v) => s + parseCurrency(v), 0),
    [amounts],
  );
  const salaryNum = parseCurrency(salaryAmount);
  const remaining = salaryNum - totalAllocated;

  const addBucket = ({
    name,
    type,
    icon,
  }: {
    name: string;
    type: Bucket['type'];
    icon: string;
  }) => {
    if (buckets.some((b) => b.name.toLowerCase() === name.toLowerCase())) return;
    const b: Bucket = {
      id: `custom-${Date.now()}`,
      name,
      icon,
      color: colors.blue,
      bgColor: colors.blueLight,
      type,
      isWallet: false,
    };
    setBuckets([...buckets, b]);
  };

  const save = async () => {
    Keyboard.dismiss();
    if (!user || !sheetId) return;
    if (salaryNum <= 0) {
      Alert.alert('Salary needed', 'Enter a salary amount to save.');
      return;
    }
    setSaving(true);
    try {
      const prev = previousMonth(month, year);
      const [prevAllocs, prevSpends] = await Promise.all([
        listAllocations(user.uid, sheetId, prev.month, prev.year),
        listSpends(user.uid, sheetId, prev.month, prev.year),
      ]);
      const prevWallet = prevAllocs.find((a) => a.bucketType === 'wallet');
      const carryForward = prevWallet
        ? computeCarryForward(
            prevWallet.allocatedAmount,
            totalSpentForMonth(prevSpends),
          )
        : 0;

      await saveSalary(user.uid, sheetId, {
        month,
        year,
        salaryAmount: salaryNum,
        source: source.trim(),
        dateCredited: toSheetDate(),
        carryForward,
      });
      const list: Allocation[] = buckets.map((b) => ({
        month,
        year,
        bucketName: b.name,
        bucketType: b.type,
        allocatedAmount: parseCurrency(amounts[b.name] || '0'),
        lastMonthAmount: lastMonthMap[b.name] ?? 0,
      }));
      await saveAllocationsForMonth(list);
      await secureStorage.setBuckets(user.uid, buckets);
      await refresh();
      Alert.alert('Saved', `${month} ${year} saved.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      Alert.alert('Save failed', msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.header}>
          {month} {year}
        </Text>

        <Text style={styles.label}>Salary amount</Text>
        <TextInput
          style={styles.input}
          value={salaryAmount}
          onChangeText={setSalaryAmount}
          keyboardType="numeric"
          placeholder="0"
        />

        <Text style={styles.label}>Source</Text>
        <TextInput
          style={styles.input}
          value={source}
          onChangeText={setSource}
          placeholder="e.g. Company"
        />

        <Pressable
          onPress={() => router.push('/(app)/income')}
          style={styles.incomeCard}
        >
          <View style={styles.incomeCardLeft}>
            <Ionicons name="trending-up" size={18} color={colors.greenDark} />
            <View style={{ flex: 1 }}>
              <Text style={styles.incomeCardLabel}>
                Extra income received this month
              </Text>
              <Text style={styles.incomeCardValue}>
                {formatCurrency(monthIncomeTotal, currency)}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.gray} />
        </Pressable>

        <Text style={styles.sectionTitle}>Allocations</Text>

        {buckets.map((b) => (
          <AllocationRow
            key={b.id}
            icon={b.icon}
            name={b.name}
            bucketType={b.type}
            lastMonth={lastMonthMap[b.name] ?? 0}
            value={amounts[b.name] ?? ''}
            onChange={(v) => setAmounts({ ...amounts, [b.name]: v })}
            highlight={b.isWallet}
            currency={currency}
          />
        ))}

        <Pressable
          onPress={() => setShowAdd(true)}
          style={styles.addBucketBtn}
        >
          <Text style={styles.addBucketText}>+ Add bucket</Text>
        </Pressable>

        <View style={styles.totalsRow}>
          <View style={styles.totalCell}>
            <Text style={styles.totalLabel}>Total allocated</Text>
            <Text style={styles.totalValue}>
              {formatCurrency(totalAllocated, currency)}
            </Text>
          </View>
          <View style={styles.totalCell}>
            <Text style={styles.totalLabel}>Remaining</Text>
            <Text
              style={[
                styles.totalValue,
                { color: remaining < 0 ? colors.red : colors.greenDark },
              ]}
            >
              {formatCurrency(remaining, currency)}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={save}
          disabled={saving}
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
        >
          <Text style={styles.saveBtnText}>
            {saving ? 'Saving…' : 'Save salary & allocations'}
          </Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
      </KeyboardAvoidingView>

      <AddBucketModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onSubmit={addBucket}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  scroll: { padding: 16 },
  header: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.gray,
    marginBottom: 16,
  },
  label: { fontSize: 12, color: colors.gray, opacity: 0.7, marginBottom: 6, marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: colors.grayLight,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: colors.gray,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.gray,
    marginTop: 20,
    marginBottom: 8,
  },
  addBucketBtn: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.gray,
    alignItems: 'center',
    marginTop: 4,
  },
  addBucketText: { color: colors.gray, fontWeight: '600' },
  totalsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  totalCell: {
    flex: 1,
    backgroundColor: colors.grayLight,
    borderRadius: 12,
    padding: 14,
  },
  totalLabel: { fontSize: 11, color: colors.gray, opacity: 0.7 },
  totalValue: { fontSize: 18, fontWeight: '800', color: colors.gray, marginTop: 4 },
  saveBtn: {
    marginTop: 16,
    backgroundColor: colors.blue,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  incomeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.greenLight,
    borderWidth: 1,
    borderColor: colors.green,
  },
  incomeCardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  incomeCardLabel: {
    fontSize: 12,
    color: colors.greenDark,
    opacity: 0.85,
    fontWeight: '600',
  },
  incomeCardValue: {
    fontSize: 16,
    color: colors.greenDark,
    fontWeight: '800',
    marginTop: 2,
  },
});
