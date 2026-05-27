import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '../../constants/colors';
import { HeroCard } from '../../components/ui/HeroCard';
import { IncomeRow } from '../../components/ui/IncomeRow';
import { AddIncomeModal } from '../../components/modals/AddIncomeModal';
import { IncomeDetailsModal } from '../../components/modals/IncomeDetailsModal';
import { useAuth } from '../../hooks/useAuth';
import { useDataContext } from '../../context/DataContext';
import { secureStorage } from '../../services/storage/secureStorage';
import {
  listIncome,
  sumIncomeByDirection,
  totalIncomeForMonth,
} from '../../services/sheets/incomeService';
import { formatCurrency } from '../../utils/formatCurrency';
import {
  fromSheetDate,
  toSheetDate,
  previousMonth,
  nextMonth,
  monthName,
  year as yearOf,
  isFutureMonth,
} from '../../utils/dateHelpers';
import type { IncomeEntry, IncomeDirection } from '../../types';

export default function IncomeScreen() {
  const router = useRouter();
  const { user, sheetId } = useAuth();
  const {
    month: ctxMonth,
    year: ctxYear,
    incomeEntries: ctxIncomeEntries,
    loading: ctxLoading,
    refresh,
    addIncome,
    updateIncome,
    removeIncome,
  } = useDataContext();

  const [currency, setCurrency] = useState('₹');
  const [showAdd, setShowAdd] = useState(false);
  const [editingEntry, setEditingEntry] = useState<IncomeEntry | null>(null);
  const [detailEntry, setDetailEntry] = useState<IncomeEntry | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | 'received' | 'returned'>(
    'all',
  );

  const [viewMonth, setViewMonth] = useState({ month: ctxMonth, year: ctxYear });
  const [viewEntries, setViewEntries] = useState<IncomeEntry[]>([]);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewReloadKey, setViewReloadKey] = useState(0);

  const isCurrentPeriod =
    viewMonth.month === ctxMonth && viewMonth.year === ctxYear;

  const month = viewMonth.month;
  const year = viewMonth.year;
  const entries = isCurrentPeriod ? ctxIncomeEntries : viewEntries;
  const loading = isCurrentPeriod ? ctxLoading : viewLoading;

  const prev = useMemo(() => previousMonth(month, year), [month, year]);
  const next = useMemo(() => nextMonth(month, year), [month, year]);
  const canGoNext = !isFutureMonth(next.month, next.year);

  useEffect(() => {
    if (!user) return;
    void secureStorage.getCurrency(user.uid).then((c) => c && setCurrency(c));
  }, [user]);

  useEffect(() => {
    if (isCurrentPeriod) return;
    if (!user || !sheetId) return;
    let cancelled = false;
    setViewLoading(true);
    setViewEntries([]);
    (async () => {
      try {
        const list = await listIncome(
          user.uid,
          sheetId,
          viewMonth.month,
          viewMonth.year,
        );
        if (cancelled) return;
        setViewEntries(list);
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof Error ? err.message : 'Could not load month';
        Alert.alert('Could not load month', msg);
      } finally {
        if (!cancelled) setViewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isCurrentPeriod, user, sheetId, viewMonth.month, viewMonth.year, viewReloadKey]);

  const monthTotal = useMemo(() => totalIncomeForMonth(entries), [entries]);
  const breakdown = useMemo(() => sumIncomeByDirection(entries), [entries]);

  const filteredEntries = useMemo(() => {
    if (typeFilter === 'all') return entries;
    if (typeFilter === 'received') return entries.filter((e) => e.direction !== 'out');
    return entries.filter((e) => e.direction === 'out');
  }, [entries, typeFilter]);

  const sortedEntries = useMemo(() => {
    return [...filteredEntries].sort((a, b) => {
      const da = fromSheetDate(a.date);
      const db = fromSheetDate(b.date);
      return db.valueOf() - da.valueOf();
    });
  }, [filteredEntries]);

  const paidBySuggestions = useMemo(() => {
    const set = new Map<string, string>();
    for (const e of entries) {
      if (e.paidBy.trim() && !set.has(e.paidBy.toLowerCase())) {
        set.set(e.paidBy.toLowerCase(), e.paidBy);
      }
    }
    return Array.from(set.values());
  }, [entries]);

  const goPrevMonth = () => setViewMonth(prev);
  const goNextMonth = () => {
    if (!canGoNext) return;
    setViewMonth(next);
  };

  const onRefresh = () => {
    if (isCurrentPeriod) {
      void refresh();
    } else {
      setViewReloadKey((k) => k + 1);
    }
  };

  const handleSubmit = async ({
    amount,
    paidBy,
    notes,
    date,
    direction,
  }: {
    amount: number;
    paidBy: string;
    notes: string;
    date: Date;
    direction: IncomeDirection;
  }) => {
    if (!user) return;
    const entryMonth = monthName(date);
    const entryYear = yearOf(date);
    try {
      const editingId = editingEntry?.id;
      const payload = {
        date: toSheetDate(date),
        month: entryMonth,
        year: entryYear,
        amount,
        paidBy,
        notes,
        direction,
      };
      if (editingId) {
        await updateIncome(editingId, payload);
        setEditingEntry(null);
        if (!isCurrentPeriod) setViewReloadKey((k) => k + 1);
      } else {
        await addIncome(payload);
        if (!isCurrentPeriod) setViewReloadKey((k) => k + 1);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save income';
      Alert.alert('Could not save income', msg);
      throw err;
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await removeIncome(id);
      if (!isCurrentPeriod) setViewReloadKey((k) => k + 1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to remove';
      Alert.alert('Could not delete', msg);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={onRefresh} />
          }
        >
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={10}
              style={styles.backBtn}
            >
              <Ionicons name="chevron-back" size={20} color={colors.blueDark} />
            </Pressable>
            <Text style={styles.headerTitle}>Extra income</Text>
            <View style={{ width: 32 }} />
          </View>

          <HeroCard backgroundColor={colors.green}>
            <Text style={styles.heroLabel}>Net this month</Text>
            <Text style={styles.heroValue}>
              {formatCurrency(monthTotal, currency)}
            </Text>
            <Text style={styles.heroSub}>
              Received {formatCurrency(breakdown.received, currency)}
              {breakdown.returned > 0
                ? ` · Returned ${formatCurrency(breakdown.returned, currency)}`
                : ''}
            </Text>
          </HeroCard>

          {isCurrentPeriod ? (
            <Pressable
              onPress={() => setShowAdd(true)}
              style={styles.quickAddBtn}
            >
              <Text style={styles.quickAddText}>+ Add income</Text>
            </Pressable>
          ) : (
            <View style={styles.viewingPast}>
              <Ionicons name="time-outline" size={14} color={colors.amber} />
              <Text style={styles.viewingPastText}>
                Viewing {month} {year} · adding income is only available for the current month
              </Text>
            </View>
          )}

          <Text style={styles.filterLabel}>Month</Text>
          <View style={styles.monthNavRow}>
            <Pressable
              onPress={goPrevMonth}
              style={styles.monthNavBtn}
              hitSlop={8}
            >
              <Ionicons name="chevron-back" size={18} color={colors.blueDark} />
            </Pressable>
            <View style={styles.monthLabelBox}>
              <Text style={styles.monthLabelText}>
                {month} {year}
              </Text>
            </View>
            <Pressable
              onPress={goNextMonth}
              disabled={!canGoNext}
              style={[styles.monthNavBtn, !canGoNext && styles.monthNavBtnDisabled]}
              hitSlop={8}
            >
              <Ionicons
                name="chevron-forward"
                size={18}
                color={canGoNext ? colors.blueDark : colors.gray}
              />
            </Pressable>
          </View>

          <Text style={styles.filterLabel}>By type</Text>
          <View style={styles.segmentRow}>
            {(['all', 'received', 'returned'] as const).map((opt) => {
              const active = typeFilter === opt;
              return (
                <Pressable
                  key={opt}
                  onPress={() => setTypeFilter(opt)}
                  style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      active && styles.segmentTextActive,
                    ]}
                  >
                    {opt === 'all'
                      ? 'All'
                      : opt === 'received'
                        ? 'Received'
                        : 'Returned'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.section}>Entries</Text>
          {sortedEntries.length === 0 ? (
            <Text style={styles.empty}>
              {typeFilter === 'all'
                ? `No income recorded for ${month} ${year}.`
                : `No ${typeFilter} entries for ${month} ${year}.`}
            </Text>
          ) : (
            sortedEntries.map((e) => (
              <IncomeRow
                key={e.id}
                entry={e}
                currency={currency}
                onPress={() => setDetailEntry(e)}
                onDelete={handleDelete}
              />
            ))
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <AddIncomeModal
        visible={showAdd || editingEntry !== null}
        onClose={() => {
          setShowAdd(false);
          setEditingEntry(null);
        }}
        onSubmit={handleSubmit}
        paidBySuggestions={paidBySuggestions}
        currency={currency}
        editing={editingEntry}
      />

      <IncomeDetailsModal
        visible={detailEntry !== null}
        entry={detailEntry}
        currency={currency}
        onClose={() => setDetailEntry(null)}
        onDelete={handleDelete}
        onEdit={(e) => {
          setDetailEntry(null);
          setEditingEntry(e);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 96 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.blueLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.gray,
  },
  heroLabel: { color: colors.white, opacity: 0.85, fontSize: 13 },
  heroValue: {
    color: colors.white,
    fontSize: 32,
    fontWeight: '800',
    marginTop: 4,
  },
  heroSub: { color: colors.white, opacity: 0.85, fontSize: 12, marginTop: 6 },
  quickAddBtn: {
    backgroundColor: colors.blue,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  quickAddText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  viewingPast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.amberLight,
    marginTop: 12,
  },
  viewingPastText: {
    flex: 1,
    fontSize: 12,
    color: colors.amber,
    fontWeight: '600',
  },
  filterLabel: {
    fontSize: 11,
    color: colors.gray,
    opacity: 0.6,
    marginTop: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  monthNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.blueLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNavBtnDisabled: { backgroundColor: colors.grayLight, opacity: 0.6 },
  monthLabelBox: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.grayLight,
    alignItems: 'center',
  },
  monthLabelText: { fontSize: 14, fontWeight: '700', color: colors.gray },
  section: {
    fontSize: 14,
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
    marginTop: 12,
  },
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: colors.grayLight,
    borderRadius: 10,
    padding: 3,
    marginTop: 4,
    gap: 3,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentBtnActive: { backgroundColor: colors.white },
  segmentText: {
    fontSize: 12,
    color: colors.gray,
    opacity: 0.7,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: colors.blueDark,
    opacity: 1,
    fontWeight: '700',
  },
});
