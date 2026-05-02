import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { colors } from '../../constants/colors';
import { formatCurrency } from '../../utils/formatCurrency';
import { ConfirmDialog } from './ConfirmDialog';
import type { WalletSpend } from '../../types';

interface SpendRowProps {
  spend: WalletSpend;
  onDelete?: (id: string) => void;
  onPress?: () => void;
  currency?: string;
}

export const SpendRow: React.FC<SpendRowProps> = ({
  spend,
  onDelete,
  onPress,
  currency = '₹',
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
      await onDelete(spend.id);
      setConfirmVisible(false);
    } catch (err) {
      setConfirmVisible(false);
      const msg = err instanceof Error ? err.message : 'Could not delete';
      Alert.alert('Delete failed', msg);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Pressable
        style={styles.row}
        onPress={onPress}
        onLongPress={onDelete ? confirm : undefined}
      >
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={styles.paidTo} numberOfLines={1}>
              {spend.paidTo || '—'}
            </Text>
            {!spend.deductsWallet ? (
              <View style={styles.lentChip}>
                <Text style={styles.lentChipText}>Lent</Text>
              </View>
            ) : null}
          </View>
          {spend.notes ? (
            <View style={styles.metaRow}>
              <Text style={styles.notes} numberOfLines={1}>
                {spend.notes}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text
            style={[styles.amount, !spend.deductsWallet && styles.amountMuted]}
          >
            {formatCurrency(spend.amount, currency)}
          </Text>
          <Text style={styles.balance}>
            Bal {formatCurrency(spend.balanceAfter, currency)}
          </Text>
          {spend.receiptLink ? (
            <Text style={styles.receiptDot}>📎</Text>
          ) : null}
        </View>
      </Pressable>

      <ConfirmDialog
        visible={confirmVisible}
        title="Delete this spend?"
        message={`${spend.paidTo || 'Spend'} · ${formatCurrency(spend.amount, currency)}`}
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
  paidTo: { fontSize: 15, fontWeight: '600', color: colors.gray, flexShrink: 1 },
  lentChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: colors.amberLight,
  },
  lentChipText: { fontSize: 10, color: colors.amber, fontWeight: '700' },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  notes: { fontSize: 12, color: colors.gray, opacity: 0.6, flexShrink: 1 },
  amount: { fontSize: 16, fontWeight: '700', color: colors.red },
  amountMuted: { color: colors.amber },
  balance: { fontSize: 11, color: colors.gray, opacity: 0.6, marginTop: 2 },
  receiptDot: { fontSize: 11, marginTop: 2, opacity: 0.7 },
});
