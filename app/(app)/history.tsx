import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { StatCard } from '../../components/ui/StatCard';
import { SpendDetailsModal } from '../../components/modals/SpendDetailsModal';
import { FixedPaymentDetailsModal } from '../../components/modals/FixedPaymentDetailsModal';
import { useAuth } from '../../hooks/useAuth';
import { useSheets } from '../../hooks/useSheets';
import { useDataContext } from '../../context/DataContext';
import { secureStorage } from '../../services/storage/secureStorage';
import { formatCurrency } from '../../utils/formatCurrency';
import { buildCsv, shareCsv } from '../../utils/exportCsv';
import type {
  MonthData,
  Allocation,
  WalletSpend,
  FixedPayment,
} from '../../types';

type ShowMode = 'All' | 'Salary' | 'Allocation' | 'Wallet' | 'Fixed';
const SHOW_MODES: ShowMode[] = ['All', 'Salary', 'Allocation', 'Wallet', 'Fixed'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
type FilterKey = 'year' | 'month' | 'show';

interface MonthBlock {
  month: string;
  year: number;
  salary: MonthData | null;
  allocations: Allocation[];
  spends: WalletSpend[];
  fixed: FixedPayment[];
}

const monthIndex = (m: string): number => MONTH_NAMES.indexOf(m);

export default function HistoryScreen() {
  const { user } = useAuth();
  const sheets = useSheets();
  const { removeSpend, removeFixedPayment } = useDataContext();

  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState('₹');
  const [salaries, setSalaries] = useState<MonthData[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [spends, setSpends] = useState<WalletSpend[]>([]);
  const [fixed, setFixed] = useState<FixedPayment[]>([]);

  const [yearFilter, setYearFilter] = useState<number | 'All'>('All');
  const [monthFilter, setMonthFilter] = useState<string | 'All'>('All');
  const [showFilter, setShowFilter] = useState<ShowMode>('All');
  const [picker, setPicker] = useState<FilterKey | null>(null);
  const [detailSpend, setDetailSpend] = useState<WalletSpend | null>(null);
  const [detailFixed, setDetailFixed] = useState<FixedPayment | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!user) return;
    void secureStorage.getCurrency(user.uid).then((c) => c && setCurrency(c));
  }, [user]);

  useEffect(() => {
    if (!sheets.ready) return;
    setLoading(true);
    (async () => {
      try {
        const [s, a, sp, f] = await Promise.all([
          sheets.listSalary(),
          sheets.listAllAllocations(),
          sheets.listSpendsAll(),
          sheets.listAllFixed(),
        ]);
        setSalaries(s);
        setAllocations(a);
        setSpends(sp);
        setFixed(f);
      } catch (err) {
        console.warn('[history] load failed', err);
        const msg = err instanceof Error ? err.message : 'Could not load history';
        Alert.alert('Could not load history', msg);
      } finally {
        setLoading(false);
      }
    })();
  }, [sheets]);

  const allBlocks: MonthBlock[] = useMemo(() => {
    const keys = new Set<string>();
    for (const s of salaries) keys.add(`${s.month}|${s.year}`);
    for (const a of allocations) keys.add(`${a.month}|${a.year}`);
    for (const s of spends) keys.add(`${s.month}|${s.year}`);
    for (const f of fixed) keys.add(`${f.month}|${f.year}`);
    const arr: MonthBlock[] = Array.from(keys).map((k) => {
      const [m, yStr] = k.split('|');
      const y = Number(yStr);
      return {
        month: m,
        year: y,
        salary: salaries.find((x) => x.month === m && x.year === y) ?? null,
        allocations: allocations.filter((x) => x.month === m && x.year === y),
        spends: spends.filter((x) => x.month === m && x.year === y),
        fixed: fixed.filter((x) => x.month === m && x.year === y),
      };
    });
    return arr.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return monthIndex(b.month) - monthIndex(a.month);
    });
  }, [salaries, allocations, spends, fixed]);

  const availableYears = useMemo(() => {
    const years = Array.from(new Set(allBlocks.map((b) => b.year)));
    return years.sort((a, b) => b - a);
  }, [allBlocks]);

  const availableMonths = useMemo(() => {
    const months = Array.from(new Set(allBlocks.map((b) => b.month)));
    return months.sort((a, b) => monthIndex(a) - monthIndex(b));
  }, [allBlocks]);

  const blocks: MonthBlock[] = useMemo(() => {
    return allBlocks.filter((b) => {
      if (yearFilter !== 'All' && b.year !== yearFilter) return false;
      if (monthFilter !== 'All' && b.month !== monthFilter) return false;
      return true;
    });
  }, [allBlocks, yearFilter, monthFilter]);

  const totals = useMemo(() => {
    const salary = blocks.reduce((s, b) => s + (b.salary?.salaryAmount ?? 0), 0);
    const spent = blocks.reduce(
      (s, b) => s + b.spends.reduce((t, x) => t + x.amount, 0),
      0,
    );
    const paid = blocks.reduce(
      (s, b) => s + b.fixed.reduce((t, x) => t + x.amount, 0),
      0,
    );
    return {
      months: blocks.length,
      salary,
      spent,
      saved: salary - spent - paid,
    };
  }, [blocks]);

  const pickerOptions: string[] = useMemo(() => {
    if (picker === 'year') return ['All', ...availableYears.map(String)];
    if (picker === 'month') return ['All', ...availableMonths];
    if (picker === 'show') return SHOW_MODES;
    return [];
  }, [picker, availableYears, availableMonths]);

  const onPickOption = (value: string) => {
    if (picker === 'year') {
      setYearFilter(value === 'All' ? 'All' : Number(value));
    } else if (picker === 'month') {
      setMonthFilter(value);
    } else if (picker === 'show') {
      setShowFilter(value as ShowMode);
    }
    setPicker(null);
  };

  const filterActive =
    yearFilter !== 'All' || monthFilter !== 'All' || showFilter !== 'All';

  const clearFilters = () => {
    setYearFilter('All');
    setMonthFilter('All');
    setShowFilter('All');
  };

  const handleDeleteSpend = async (id: string) => {
    await removeSpend(id);
    setSpends((cur) => cur.filter((s) => s.id !== id));
  };

  const handleDeleteFixed = async (id: string) => {
    await removeFixedPayment(id);
    setFixed((cur) => cur.filter((p) => p.id !== id));
  };

  const handleExport = async () => {
    if (blocks.length === 0) {
      Alert.alert('Nothing to export', 'No rows match the current filter.');
      return;
    }
    setExporting(true);
    try {
      const includeSalary = showFilter === 'All' || showFilter === 'Salary';
      const includeAlloc = showFilter === 'All' || showFilter === 'Allocation';
      const includeWallet = showFilter === 'All' || showFilter === 'Wallet';
      const includeFixed = showFilter === 'All' || showFilter === 'Fixed';

      const headers = [
        'Type',
        'Month',
        'Year',
        'Date',
        'Label',
        `Amount (${currency})`,
        'Details',
        'Receipt',
      ];
      const rows: (string | number)[][] = [];

      for (const b of blocks) {
        if (includeSalary && b.salary) {
          rows.push([
            'Salary',
            b.month,
            b.year,
            b.salary.dateCredited,
            'Salary credit',
            b.salary.salaryAmount,
            b.salary.source,
            '',
          ]);
        }
        if (includeAlloc) {
          for (const a of b.allocations) {
            rows.push([
              'Allocation',
              b.month,
              b.year,
              '',
              a.bucketName,
              a.allocatedAmount,
              `type:${a.bucketType}`,
              '',
            ]);
          }
        }
        if (includeWallet) {
          for (const s of b.spends) {
            const detail = [s.paidTo, s.purpose, s.notes]
              .filter(Boolean)
              .join(' · ');
            rows.push([
              'Wallet',
              b.month,
              b.year,
              s.date,
              s.purpose || s.paidTo || 'Spend',
              s.amount,
              detail,
              s.receiptLink,
            ]);
          }
        }
        if (includeFixed) {
          for (const p of b.fixed) {
            const detail = [p.paymentType, p.paidTo, p.notes]
              .filter(Boolean)
              .join(' · ');
            rows.push([
              'Fixed',
              b.month,
              b.year,
              p.datePaid,
              p.bucketName,
              p.amount,
              detail,
              p.receiptLink,
            ]);
          }
        }
      }

      if (rows.length === 0) {
        Alert.alert('Nothing to export', 'No rows match the current filter.');
        return;
      }

      const csv = buildCsv(headers, rows);
      const parts = [
        'history',
        yearFilter === 'All' ? 'allyears' : String(yearFilter),
        monthFilter === 'All' ? 'allmonths' : monthFilter,
        showFilter.toLowerCase(),
      ];
      await shareCsv(`${parts.join('_')}.csv`, csv);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not export';
      Alert.alert('Export failed', msg);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.blue} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>History</Text>

        <View style={styles.filterCard}>
          <View style={styles.filterHeaderRow}>
            <View style={styles.filterTitleRow}>
              <Ionicons name="filter" size={16} color={colors.gray} />
              <Text style={styles.filterTitle}>Filters</Text>
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>
                  {blocks.length} {blocks.length === 1 ? 'month' : 'months'}
                </Text>
              </View>
            </View>
            {filterActive ? (
              <Pressable onPress={clearFilters} hitSlop={8}>
                <Text style={styles.clearLink}>Clear</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.filterRow}>
            <FilterPill
              label="Year"
              value={yearFilter === 'All' ? 'All' : String(yearFilter)}
              onPress={() => setPicker('year')}
            />
            <FilterPill
              label="Month"
              value={monthFilter}
              onPress={() => setPicker('month')}
            />
            <FilterPill
              label="Show"
              value={showFilter}
              onPress={() => setPicker('show')}
            />
          </View>

          <Pressable
            onPress={handleExport}
            disabled={exporting || blocks.length === 0}
            style={[
              styles.downloadBtn,
              (exporting || blocks.length === 0) && styles.downloadBtnDisabled,
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

        <View style={styles.statRow}>
          <StatCard
            label="Months tracked"
            value={String(totals.months)}
            bgColor={colors.grayLight}
          />
          <StatCard
            label="Total salary"
            value={formatCurrency(totals.salary, currency)}
            bgColor={colors.blueLight}
            color={colors.blueDark}
          />
        </View>
        <View style={[styles.statRow, { marginTop: 10 }]}>
          <StatCard
            label="Total spent"
            value={formatCurrency(totals.spent, currency)}
            bgColor={colors.redLight}
            color={colors.red}
          />
          <StatCard
            label="Total saved"
            value={formatCurrency(totals.saved, currency)}
            bgColor={colors.greenLight}
            color={colors.greenDark}
          />
        </View>

        {blocks.length === 0 ? (
          <Text style={styles.empty}>No history yet.</Text>
        ) : (
          blocks.map((b) => {
            const monthSpent = b.spends.reduce((s, x) => s + x.amount, 0);
            const monthPaid = b.fixed.reduce((s, x) => s + x.amount, 0);
            const showAll = showFilter === 'All';
            return (
              <View key={`${b.month}-${b.year}`} style={styles.block}>
                <View style={styles.blockHeader}>
                  <Text style={styles.blockTitle}>
                    {b.month} {b.year}
                  </Text>
                  <Text style={styles.blockSub}>
                    Salary {formatCurrency(b.salary?.salaryAmount ?? 0, currency)} ·{' '}
                    {formatCurrency(monthSpent, currency)} spent
                  </Text>
                </View>

                {(showAll || showFilter === 'Salary') && b.salary ? (
                  <View style={styles.salaryCard}>
                    <Text style={styles.salaryLabel}>Salary</Text>
                    <Text style={styles.salaryValue}>
                      {formatCurrency(b.salary.salaryAmount, currency)}
                    </Text>
                    {b.salary.source ? (
                      <Text style={styles.salarySub}>from {b.salary.source}</Text>
                    ) : null}
                  </View>
                ) : null}

                {(showAll || showFilter === 'Allocation') && b.allocations.length > 0 ? (
                  <View style={styles.table}>
                    <View style={[styles.tableRow, styles.tableHead]}>
                      <Text style={[styles.cell, styles.cellHead, { flex: 1.4 }]}>
                        Bucket
                      </Text>
                      <Text style={[styles.cell, styles.cellHead]}>Allocated</Text>
                      <Text style={[styles.cell, styles.cellHead]}>Actual</Text>
                      <Text style={[styles.cell, styles.cellHead]}>Left</Text>
                    </View>
                    {b.allocations.map((a) => {
                      const paidForBucket = b.fixed
                        .filter((p) => p.bucketName === a.bucketName)
                        .reduce((s, p) => s + p.amount, 0);
                      const actual = a.bucketType === 'wallet'
                        ? monthSpent
                        : paidForBucket;
                      const left = a.allocatedAmount - actual;
                      return (
                        <View key={a.bucketName} style={styles.tableRow}>
                          <Text style={[styles.cell, { flex: 1.4 }]}>
                            {a.bucketName}
                          </Text>
                          <Text style={styles.cell}>
                            {formatCurrency(a.allocatedAmount, currency)}
                          </Text>
                          <Text style={styles.cell}>
                            {formatCurrency(actual, currency)}
                          </Text>
                          <Text
                            style={[
                              styles.cell,
                              { color: left < 0 ? colors.red : colors.greenDark },
                            ]}
                          >
                            {formatCurrency(left, currency)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ) : null}

                {(showAll || showFilter === 'Wallet') && b.spends.length > 0 ? (
                  <View style={styles.itemList}>
                    <Text style={styles.itemListTitle}>Wallet spends</Text>
                    {b.spends.map((s) => (
                      <Pressable
                        key={s.id}
                        style={styles.itemRow}
                        onPress={() => setDetailSpend(s)}
                      >
                        <Text style={styles.itemMain}>
                          {s.purpose || s.paidTo || 'Spend'}
                        </Text>
                        <Text style={styles.itemSub}>{s.date}</Text>
                        <Text style={styles.itemAmount}>
                          {formatCurrency(s.amount, currency)}
                        </Text>
                        {s.receiptLink ? (
                          <Ionicons
                            name="attach"
                            size={14}
                            color={colors.blueDark}
                            style={{ marginLeft: 6 }}
                          />
                        ) : null}
                      </Pressable>
                    ))}
                  </View>
                ) : null}

                {(showAll || showFilter === 'Fixed') && b.fixed.length > 0 ? (
                  <View style={styles.itemList}>
                    <Text style={styles.itemListTitle}>Fixed payments</Text>
                    {b.fixed.map((p) => (
                      <Pressable
                        key={p.id}
                        style={styles.itemRow}
                        onPress={() => setDetailFixed(p)}
                      >
                        <Text style={styles.itemMain}>{p.bucketName}</Text>
                        <Text style={styles.itemSub}>{p.datePaid}</Text>
                        <Text style={styles.itemAmount}>
                          {formatCurrency(p.amount, currency)}
                        </Text>
                        {p.receiptLink ? (
                          <Ionicons
                            name="attach"
                            size={14}
                            color={colors.blueDark}
                            style={{ marginLeft: 6 }}
                          />
                        ) : null}
                      </Pressable>
                    ))}
                  </View>
                ) : null}

                {showAll ? (
                  <Text style={styles.summary}>
                    Salary {formatCurrency(b.salary?.salaryAmount ?? 0, currency)} − Paid{' '}
                    {formatCurrency(monthPaid, currency)} − Wallet{' '}
                    {formatCurrency(monthSpent, currency)} ={' '}
                    {formatCurrency(
                      (b.salary?.salaryAmount ?? 0) - monthPaid - monthSpent,
                      currency,
                    )}
                  </Text>
                ) : null}
              </View>
            );
          })
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal
        visible={picker !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPicker(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setPicker(null)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>
              {picker === 'year' ? 'Year' : picker === 'month' ? 'Month' : 'Show'}
            </Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {pickerOptions.map((opt) => {
                const current =
                  picker === 'year'
                    ? yearFilter === 'All' ? 'All' : String(yearFilter)
                    : picker === 'month'
                    ? monthFilter
                    : showFilter;
                const selected = opt === current;
                return (
                  <Pressable
                    key={opt}
                    style={[styles.modalOption, selected && styles.modalOptionSel]}
                    onPress={() => onPickOption(opt)}
                  >
                    <Text style={[styles.modalOptionText, selected && styles.modalOptionTextSel]}>
                      {opt}
                    </Text>
                    {selected ? (
                      <Ionicons name="checkmark" size={18} color={colors.blue} />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <SpendDetailsModal
        visible={detailSpend !== null}
        spend={detailSpend}
        currency={currency}
        onClose={() => setDetailSpend(null)}
        onDelete={handleDeleteSpend}
      />

      <FixedPaymentDetailsModal
        visible={detailFixed !== null}
        payment={detailFixed}
        currency={currency}
        onClose={() => setDetailFixed(null)}
        onDelete={handleDeleteFixed}
      />
    </SafeAreaView>
  );
}

const FilterPill: React.FC<{
  label: string;
  value: string;
  onPress: () => void;
}> = ({ label, value, onPress }) => (
  <Pressable style={styles.pill} onPress={onPress}>
    <Text style={styles.pillLabel}>{label}</Text>
    <Text style={styles.pillValue} numberOfLines={1}>
      {value}
    </Text>
    <Ionicons name="chevron-down" size={14} color={colors.gray} />
  </Pressable>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16 },
  title: { fontSize: 22, fontWeight: '800', color: colors.gray, marginBottom: 16 },
  filterCard: {
    marginBottom: 14,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.grayLight,
    backgroundColor: colors.white,
    gap: 10,
  },
  filterHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.blue,
  },
  downloadBtnDisabled: { opacity: 0.5 },
  downloadBtnText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  filterRow: { flexDirection: 'row', gap: 8 },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: colors.grayLight,
  },
  pillLabel: { fontSize: 11, color: colors.gray, opacity: 0.6 },
  pillValue: { flex: 1, fontSize: 13, color: colors.gray, fontWeight: '700' },
  statRow: { flexDirection: 'row', gap: 10 },
  empty: {
    textAlign: 'center',
    fontSize: 13,
    color: colors.gray,
    opacity: 0.6,
    marginTop: 32,
  },
  block: {
    marginTop: 20,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.grayLight,
  },
  blockHeader: { marginBottom: 10 },
  blockTitle: { fontSize: 15, fontWeight: '800', color: colors.gray },
  blockSub: { fontSize: 12, color: colors.gray, opacity: 0.7, marginTop: 2 },
  table: { marginTop: 4 },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.grayLight,
  },
  cell: { flex: 1, fontSize: 12, color: colors.gray },
  tableHead: { borderBottomWidth: 1, borderBottomColor: colors.grayLight },
  cellHead: { fontWeight: '700', opacity: 0.7 },
  salaryCard: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.blueLight,
    marginTop: 4,
  },
  salaryLabel: { fontSize: 11, color: colors.blueDark, opacity: 0.7 },
  salaryValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.blueDark,
    marginTop: 2,
  },
  salarySub: { fontSize: 12, color: colors.blueDark, opacity: 0.7, marginTop: 2 },
  itemList: { marginTop: 12 },
  itemListTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gray,
    opacity: 0.7,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.grayLight,
  },
  itemMain: { flex: 1, fontSize: 13, color: colors.gray, fontWeight: '600' },
  itemSub: { fontSize: 11, color: colors.gray, opacity: 0.6, marginRight: 8 },
  itemAmount: { fontSize: 13, color: colors.gray, fontWeight: '700' },
  summary: {
    marginTop: 10,
    fontSize: 12,
    color: colors.gray,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 32,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.gray,
    marginBottom: 12,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  modalOptionSel: { backgroundColor: colors.blueLight },
  modalOptionText: { flex: 1, fontSize: 14, color: colors.gray },
  modalOptionTextSel: { color: colors.blueDark, fontWeight: '700' },
});
