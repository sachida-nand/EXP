import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { colors } from '../../constants/colors';
import { formatCurrency } from '../../utils/formatCurrency';
import { ConfirmDialog } from './ConfirmDialog';
import type { IncomeEntry } from '../../types';

interface IncomeRowProps {
  entry: IncomeEntry;
  currency?: string;
  onPress?: () => void;
  onDelete?: (id: string) => void;
}

export const IncomeRow: React.FC<IncomeRowProps> = ({
  entry,
  currency = '₹',
  onPress,
  onDelete,
}) => {
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const confirm = () => {
    if (!onDelete) return;
    setConfirmVisible(true);
  };

  const runDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete(entry.id);
      setConfirmVisible(false);
    } catch (err) {
      setConfirmVisible(false);
      const msg = err instanceof Error ? err.message : 'Could not delete';
      Alert.alert('Delete failed', msg);
    } finally {
      setDeleting(false);
    }
  };

  const isOut = entry.direction === 'out';

  return (
    <>
      <Pressable
        style={styles.row}
        onPress={onPress}
        onLongPress={onDelete ? confirm : undefined}
      >
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={styles.paidBy} numberOfLines={1}>
              {entry.paidBy || '—'}
            </Text>
            {isOut ? (
              <View style={styles.returnChip}>
                <Text style={styles.returnChipText}>Returned</Text>
              </View>
            ) : null}
          </View>
          {entry.notes ? (
            <Text style={styles.notes} numberOfLines={1}>
              {entry.notes}
            </Text>
          ) : null}
        </View>
        <Text style={[styles.amount, isOut && styles.amountOut]}>
          {isOut ? '-' : '+'}
          {formatCurrency(entry.amount, currency)}
        </Text>
      </Pressable>

      <ConfirmDialog
        visible={confirmVisible}
        title="Delete this income?"
        message={`${entry.paidBy || 'Income'} · ${formatCurrency(entry.amount, currency)}`}
        confirmLabel="Delete"
        destructive
        busy={deleting}
        icon="trash-outline"
        onCancel={() => setConfirmVisible(false)}
        onConfirm={runDelete}
      />
    </>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.grayLight,
    gap: 12,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  paidBy: { fontSize: 15, fontWeight: '600', color: colors.gray, flexShrink: 1 },
  returnChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: colors.amberLight,
  },
  returnChipText: { fontSize: 10, color: colors.amber, fontWeight: '700' },
  notes: {
    fontSize: 12,
    color: colors.gray,
    opacity: 0.6,
    marginTop: 4,
  },
  amount: { fontSize: 16, fontWeight: '700', color: colors.green },
  amountOut: { color: colors.amber },
});
