import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Alert,
  Keyboard,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import dayjs from 'dayjs';
import { colors } from '../../constants/colors';
import { HeroCard, ProgressBar } from '../../components/ui/HeroCard';
import { SpendRow } from '../../components/ui/SpendRow';
import { PurposeChips } from '../../components/ui/PurposeChips';
import { AddSpendModal } from '../../components/modals/AddSpendModal';
import { SpendDetailsModal } from '../../components/modals/SpendDetailsModal';
import { useAuth } from '../../hooks/useAuth';
import { useDataContext } from '../../context/DataContext';
import { secureStorage } from '../../services/storage/secureStorage';
import {
  ensureReceiptsFolder,
  uploadReceiptImage,
} from '../../services/drive/driveReceipts';
import { formatCurrency, formatSigned } from '../../utils/formatCurrency';
import {
  fromSheetDate,
  toSheetDate,
  previousMonth,
  nextMonth,
  monthName,
  year as yearOf,
  monthStart,
  monthEnd,
  isFutureMonth,
} from '../../utils/dateHelpers';
import { buildCsv, shareCsv } from '../../utils/exportCsv';
import {
  listSpends,
  totalSpentForMonth,
} from '../../services/sheets/walletService';
import { listAllocations } from '../../services/sheets/allocationsService';
import { computeCarryForward } from '../../utils/carryForward';
import type { WalletSpend, Allocation } from '../../types';

export default function WalletScreen() {
  const { user, sheetId } = useAuth();
  const {
    month: ctxMonth,
    year: ctxYear,
    spends: ctxSpends,
    allocations: ctxAllocations,
    purposes,
    carryForward: ctxCarryForward,
    loading: ctxLoading,
    refresh,
    addSpend,
    removeSpend,
    addPurpose,
  } = useDataContext();

  const [currency, setCurrency] = useState('₹');
  const [selectedPurpose, setSelectedPurpose] = useState<string | null>(null);
  const [paidToFilter, setPaidToFilter] = useState('');
  const [dateFilter, setDateFilter] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [paidToRecents, setPaidToRecents] = useState<string[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [detailSpend, setDetailSpend] = useState<WalletSpend | null>(null);
  const [exporting, setExporting] = useState(false);

  const [viewMonth, setViewMonth] = useState({
    month: ctxMonth,
    year: ctxYear,
  });
  const [viewSpends, setViewSpends] = useState<WalletSpend[]>([]);
  const [viewAllocations, setViewAllocations] = useState<Allocation[]>([]);
  const [viewCarryForward, setViewCarryForward] = useState(0);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewReloadKey, setViewReloadKey] = useState(0);

  const isCurrentPeriod =
    viewMonth.month === ctxMonth && viewMonth.year === ctxYear;

  const month = viewMonth.month;
  const year = viewMonth.year;
  const spends = isCurrentPeriod ? ctxSpends : viewSpends;
  const allocations = isCurrentPeriod ? ctxAllocations : viewAllocations;
  const carryForward = isCurrentPeriod ? ctxCarryForward : viewCarryForward;
  const loading = isCurrentPeriod ? ctxLoading : viewLoading;

  const walletBucket = useMemo(
    () => allocations.find((a) => a.bucketType === 'wallet'),
    [allocations],
  );
  const walletBudget = (walletBucket?.allocatedAmount ?? 0) + carryForward;
  const walletSpent = useMemo(() => totalSpentForMonth(spends), [spends]);
  const walletRemaining = walletBudget - walletSpent;

  useEffect(() => {
    if (!user) return;
    void secureStorage.getCurrency(user.uid).then((c) => c && setCurrency(c));
    void secureStorage.getPaidToRecents(user.uid).then(setPaidToRecents);
  }, [user]);

  useEffect(() => {
    setDateFilter(null);
  }, [viewMonth.month, viewMonth.year]);

  useEffect(() => {
    if (isCurrentPeriod) return;
    if (!user || !sheetId) return;
    let cancelled = false;
    setViewLoading(true);
    setViewSpends([]);
    setViewAllocations([]);
    setViewCarryForward(0);
    (async () => {
      try {
        const [vSpends, vAllocs] = await Promise.all([
          listSpends(user.uid, sheetId, viewMonth.month, viewMonth.year),
          listAllocations(user.uid, sheetId, viewMonth.month, viewMonth.year),
        ]);
        const prevView = previousMonth(viewMonth.month, viewMonth.year);
        const [prevAllocs, prevSpends] = await Promise.all([
          listAllocations(user.uid, sheetId, prevView.month, prevView.year),
          listSpends(user.uid, sheetId, prevView.month, prevView.year),
        ]);
        const prevWallet = prevAllocs.find((a) => a.bucketType === 'wallet');
        const cf = prevWallet
          ? computeCarryForward(
              prevWallet.allocatedAmount,
              totalSpentForMonth(prevSpends),
            )
          : 0;
        if (cancelled) return;
        setViewSpends(vSpends);
        setViewAllocations(vAllocs);
        setViewCarryForward(cf);
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
  }, [
    isCurrentPeriod,
    user,
    sheetId,
    viewMonth.month,
    viewMonth.year,
    viewReloadKey,
  ]);

  const periodStart = useMemo(() => monthStart(month, year), [month, year]);
  const periodEnd = useMemo(() => monthEnd(month, year), [month, year]);
  const today = useMemo(() => new Date(), []);
  const datePickerMax = today < periodEnd ? today : periodEnd;
  const prev = useMemo(() => previousMonth(month, year), [month, year]);
  const next = useMemo(() => nextMonth(month, year), [month, year]);
  const canGoNext = !isFutureMonth(next.month, next.year);

  const paidToSuggestions = useMemo(() => {
    const set = new Map<string, string>();
    for (const r of paidToRecents) {
      if (r.trim()) set.set(r.toLowerCase(), r);
    }
    for (const s of spends) {
      if (s.paidTo.trim() && !set.has(s.paidTo.toLowerCase())) {
        set.set(s.paidTo.toLowerCase(), s.paidTo);
      }
    }
    return Array.from(set.values());
  }, [paidToRecents, spends]);

  const filteredSpends = useMemo(() => {
    const needle = paidToFilter.trim().toLowerCase();
    const dateKey = dateFilter ? toSheetDate(dateFilter) : null;
    return spends.filter((s) => {
      if (selectedPurpose && s.purpose.toLowerCase() !== selectedPurpose.toLowerCase()) {
        return false;
      }
      if (needle && !s.paidTo.toLowerCase().includes(needle)) {
        return false;
      }
      if (dateKey && s.date !== dateKey) {
        return false;
      }
      return true;
    });
  }, [spends, selectedPurpose, paidToFilter, dateFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, WalletSpend[]>();
    for (const s of filteredSpends) {
      const key = s.date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return Array.from(map.entries()).sort((a, b) => {
      const da = fromSheetDate(a[0]);
      const db = fromSheetDate(b[0]);
      return db.valueOf() - da.valueOf();
    });
  }, [filteredSpends]);

  const filteredTotal = useMemo(
    () => filteredSpends.reduce((s, x) => s + x.amount, 0),
    [filteredSpends],
  );

  const filterActive =
    selectedPurpose !== null ||
    paidToFilter.trim().length > 0 ||
    dateFilter !== null;
  const clearFilters = () => {
    setSelectedPurpose(null);
    setPaidToFilter('');
    setDateFilter(null);
  };

  const onPickDate = (e: DateTimePickerEvent, picked?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (e.type === 'dismissed' || !picked) return;
    setDateFilter(picked);
  };

  const goPrevMonth = () => {
    setViewMonth(prev);
  };
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
    paidTo,
    purpose,
    notes,
    date,
    image,
  }: {
    amount: number;
    paidTo: string;
    purpose: string;
    notes: string;
    date: Date;
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
        const finalName = `${safeStamp}${ext}`;
        receiptLink = await uploadReceiptImage(
          user.uid,
          folderId,
          image.uri,
          finalName,
          image.mimeType,
        );
      }
      await addSpend({
        date: toSheetDate(date),
        month: spendMonth,
        year: spendYear,
        amount,
        paidTo,
        purpose,
        notes,
        receiptLink,
      });
      if (purpose && !purposes.some((p) => p.name.toLowerCase() === purpose.toLowerCase())) {
        await addPurpose(purpose);
      }
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

  const handleExport = async () => {
    Keyboard.dismiss();
    if (filteredSpends.length === 0) {
      Alert.alert('Nothing to export', 'No spends match the current filter.');
      return;
    }
    setExporting(true);
    try {
      const headers = [
        'Date',
        'Month',
        'Year',
        `Amount (${currency})`,
        'Paid to',
        'Purpose',
        'Notes',
        `Balance after (${currency})`,
        'Receipt',
      ];
      const rows = filteredSpends.map((s) => [
        s.date,
        s.month,
        s.year,
        s.amount,
        s.paidTo,
        s.purpose,
        s.notes,
        s.balanceAfter,
        s.receiptLink,
      ]);
      const csv = buildCsv(headers, rows);
      const parts = [
        'spends',
        month,
        year,
        selectedPurpose ? `purpose-${selectedPurpose}` : null,
        paidToFilter.trim() ? `to-${paidToFilter.trim()}` : null,
      ].filter(Boolean);
      await shareCsv(`${parts.join('_')}.csv`, csv);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not export';
      Alert.alert('Export failed', msg);
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await removeSpend(id);
      if (!isCurrentPeriod) {
        setViewReloadKey((k) => k + 1);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to remove';
      Alert.alert('Could not delete', msg);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={onRefresh} />
        }
      >
        <HeroCard backgroundColor={colors.green}>
          <Text style={styles.heroLabel}>Remaining balance</Text>
          <Text style={styles.heroValue}>
            {formatCurrency(walletRemaining, currency)}
          </Text>
          <Text style={styles.heroSub}>
            of {formatCurrency(walletBudget, currency)} budget
            {carryForward !== 0 ? ` · ${formatSigned(carryForward, currency)} carry from ${prev.month}` : ''}
          </Text>
          <ProgressBar value={walletSpent} max={walletBudget} />
          <Text style={styles.heroSub}>
            Spent: {formatCurrency(walletSpent, currency)}
          </Text>
        </HeroCard>

        {!walletBucket ? (
          <Text style={styles.warn}>
            No wallet budget set for this month. Go to Salary to allocate.
          </Text>
        ) : null}

        {isCurrentPeriod ? (
          <Pressable
            onPress={() => setShowAdd(true)}
            style={styles.quickAddBtn}
          >
            <Text style={styles.quickAddText}>+ Add spend</Text>
          </Pressable>
        ) : (
          <View style={styles.viewingPast}>
            <Ionicons name="time-outline" size={14} color={colors.amber} />
            <Text style={styles.viewingPastText}>
              Viewing {month} {year} · adding spends is only available for the current month
            </Text>
          </View>
        )}

        <View style={styles.filterCard}>
          <View style={styles.filterHeaderRow}>
            <View style={styles.filterTitleRow}>
              <Ionicons name="filter" size={16} color={colors.gray} />
              <Text style={styles.filterTitle}>Filters</Text>
              {filterActive ? (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>
                    {filteredSpends.length}
                  </Text>
                </View>
              ) : null}
            </View>
            {filterActive ? (
              <Pressable onPress={clearFilters} hitSlop={8}>
                <Text style={styles.clearLink}>Clear</Text>
              </Pressable>
            ) : null}
          </View>

          <Text style={styles.filterLabel}>Month</Text>
          <View style={styles.monthNavRow}>
            <Pressable onPress={goPrevMonth} style={styles.monthNavBtn} hitSlop={8}>
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

          <Text style={styles.filterLabel}>By date</Text>
          <View style={styles.dateRow}>
            <Pressable
              onPress={() => setShowDatePicker(true)}
              style={styles.dateBtn}
            >
              <Ionicons name="calendar-outline" size={16} color={colors.blueDark} />
              <Text style={styles.dateBtnText}>
                {dateFilter
                  ? dayjs(dateFilter).format('DD MMM YYYY')
                  : 'Any day'}
              </Text>
            </Pressable>
            {dateFilter ? (
              <Pressable
                onPress={() => setDateFilter(null)}
                hitSlop={8}
                style={styles.dateClearBtn}
              >
                <Ionicons name="close-circle" size={18} color={colors.gray} />
              </Pressable>
            ) : null}
          </View>
          {showDatePicker ? (
            <DateTimePicker
              value={dateFilter ?? datePickerMax}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              minimumDate={periodStart}
              maximumDate={datePickerMax}
              onChange={onPickDate}
            />
          ) : null}

          <Text style={styles.filterLabel}>By purpose</Text>
          <PurposeChips
            purposes={purposes.map((p) => p.name)}
            selected={selectedPurpose}
            onSelect={(p) =>
              setSelectedPurpose((cur) => (cur === p ? null : p))
            }
          />

          <Text style={styles.filterLabel}>By paid to</Text>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={colors.gray} />
            <TextInput
              style={styles.searchInput}
              value={paidToFilter}
              onChangeText={setPaidToFilter}
              placeholder="Type a name, e.g. Ride"
              placeholderTextColor={colors.gray}
            />
            {paidToFilter.length > 0 ? (
              <Pressable onPress={() => setPaidToFilter('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={colors.gray} />
              </Pressable>
            ) : null}
          </View>

          <Pressable
            onPress={handleExport}
            disabled={exporting || filteredSpends.length === 0}
            style={[
              styles.downloadBtn,
              (exporting || filteredSpends.length === 0) && styles.downloadBtnDisabled,
            ]}
          >
            <Ionicons
              name={exporting ? 'hourglass-outline' : 'download-outline'}
              size={16}
              color={colors.white}
            />
            <Text style={styles.downloadBtnText}>
              {exporting ? 'Exporting…' : 'Download CSV'}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.section}>Spends</Text>
        {grouped.length === 0 ? (
          <Text style={styles.empty}>
            {filterActive ? 'No spends match the filter.' : 'No spends this month yet.'}
          </Text>
        ) : (
          grouped.map(([date, list]) => {
            const total = list.reduce((s, x) => s + x.amount, 0);
            return (
              <View key={date} style={styles.dayBlock}>
                <View style={styles.dayHeader}>
                  <Text style={styles.dayDate}>{date}</Text>
                  <Text style={styles.daySum}>
                    {formatCurrency(total, currency)} spent
                  </Text>
                </View>
                {list.map((s) => (
                  <SpendRow
                    key={s.id}
                    spend={s}
                    currency={currency}
                    onDelete={handleDelete}
                    onPress={() => setDetailSpend(s)}
                  />
                ))}
              </View>
            );
          })
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <AddSpendModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onSubmit={handleSubmit}
        initialPurpose={selectedPurpose ?? ''}
        purposes={purposes.map((p) => p.name)}
        paidToSuggestions={paidToSuggestions}
        currency={currency}
      />

      <SpendDetailsModal
        visible={detailSpend !== null}
        spend={detailSpend}
        currency={currency}
        onClose={() => setDetailSpend(null)}
        onDelete={handleDelete}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  scroll: { padding: 16 },
  heroLabel: { color: colors.white, opacity: 0.8, fontSize: 13 },
  heroValue: {
    color: colors.white,
    fontSize: 32,
    fontWeight: '800',
    marginTop: 4,
  },
  heroSub: { color: colors.white, opacity: 0.85, fontSize: 12, marginTop: 6 },
  warn: {
    padding: 12,
    backgroundColor: colors.amberLight,
    color: colors.amber,
    borderRadius: 10,
    fontSize: 13,
    marginBottom: 12,
  },
  quickAddBtn: {
    backgroundColor: colors.blue,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
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
  },
  viewingPastText: {
    flex: 1,
    fontSize: 12,
    color: colors.amber,
    fontWeight: '600',
  },
  section: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.gray,
    marginTop: 16,
    marginBottom: 8,
  },
  filterCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.grayLight,
    backgroundColor: colors.white,
    gap: 6,
  },
  filterHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  filterTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterTitle: { fontSize: 14, fontWeight: '700', color: colors.gray },
  filterBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: colors.blueLight,
  },
  filterBadgeText: { fontSize: 11, color: colors.blueDark, fontWeight: '700' },
  clearLink: { fontSize: 12, color: colors.blueDark, fontWeight: '700' },
  filterLabel: {
    fontSize: 11,
    color: colors.gray,
    opacity: 0.6,
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.grayLight,
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
  monthNavBtnDisabled: {
    backgroundColor: colors.grayLight,
    opacity: 0.6,
  },
  monthLabelBox: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.grayLight,
    alignItems: 'center',
  },
  monthLabelText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.gray,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  dateBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.blueLight,
  },
  dateBtnText: {
    fontSize: 13,
    color: colors.blueDark,
    fontWeight: '700',
  },
  dateClearBtn: {
    padding: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.gray,
    padding: 0,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.blue,
  },
  downloadBtnDisabled: { opacity: 0.5 },
  downloadBtnText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  empty: {
    fontSize: 13,
    color: colors.gray,
    opacity: 0.6,
    textAlign: 'center',
    marginTop: 12,
  },
  dayBlock: { marginBottom: 12 },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  dayDate: { fontSize: 13, fontWeight: '700', color: colors.gray },
  daySum: { fontSize: 13, color: colors.gray, opacity: 0.7 },
});
