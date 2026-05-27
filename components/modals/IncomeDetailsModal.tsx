import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { formatCurrency } from '../../utils/formatCurrency';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import type { IncomeEntry } from '../../types';

interface IncomeDetailsModalProps {
  visible: boolean;
  entry: IncomeEntry | null;
  currency?: string;
  onClose: () => void;
  onDelete?: (id: string) => Promise<void> | void;
  onEdit?: (entry: IncomeEntry) => void;
}

export const IncomeDetailsModal: React.FC<IncomeDetailsModalProps> = ({
  visible,
  entry,
  currency = '₹',
  onClose,
  onDelete,
  onEdit,
}) => {
  const [deleting, setDeleting] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);

  if (!entry) return null;
  const isOut = entry.direction === 'out';

  const confirmDelete = () => {
    if (!onDelete || deleting) return;
    setConfirmVisible(true);
  };

  const runDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete(entry.id);
      setConfirmVisible(false);
      onClose();
    } catch (err) {
      setConfirmVisible(false);
      const msg = err instanceof Error ? err.message : 'Could not delete';
      Alert.alert('Delete failed', msg);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Text style={styles.title}>
            {isOut ? 'Return details' : 'Income details'}
          </Text>

          <View style={[styles.amountBox, isOut && styles.amountBoxOut]}>
            <Text style={[styles.amountLabel, isOut && styles.amountLabelOut]}>
              Amount
            </Text>
            <Text style={[styles.amountValue, isOut && styles.amountValueOut]}>
              {isOut ? '-' : '+'}
              {formatCurrency(entry.amount, currency)}
            </Text>
          </View>

          <DetailRow label="Type" value={isOut ? 'Returned' : 'Received'} />
          <DetailRow label="Date" value={entry.date} />
          <DetailRow
            label={isOut ? 'Paid to' : 'Paid by'}
            value={entry.paidBy || '—'}
          />
          <DetailRow label="Month" value={`${entry.month} ${entry.year}`} />
          {entry.notes ? (
            <DetailRow
              label={isOut ? 'Remark' : 'Notes'}
              value={entry.notes}
            />
          ) : null}

          <View style={styles.actionRow}>
            {onEdit ? (
              <Pressable
                onPress={() => {
                  if (deleting) return;
                  onEdit(entry);
                }}
                disabled={deleting}
                style={[styles.editBtn, deleting && styles.btnDisabled]}
              >
                <Ionicons name="create-outline" size={16} color={colors.white} />
                <Text style={styles.editBtnText}>Edit</Text>
              </Pressable>
            ) : null}
            {onDelete ? (
              <Pressable
                onPress={confirmDelete}
                disabled={deleting}
                style={[styles.deleteBtn, deleting && styles.btnDisabled]}
              >
                <Ionicons name="trash-outline" size={16} color={colors.white} />
                <Text style={styles.deleteBtnText}>
                  {deleting ? 'Deleting…' : 'Delete'}
                </Text>
              </Pressable>
            ) : null}
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>Close</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>

      <ConfirmDialog
        visible={confirmVisible}
        title="Delete this income?"
        message={`${entry.paidBy || 'Income'} · ${formatCurrency(entry.amount, currency)} on ${entry.date}\n\nThis will remove the row from your sheet.`}
        confirmLabel="Delete"
        destructive
        busy={deleting}
        icon="trash-outline"
        onCancel={() => setConfirmVisible(false)}
        onConfirm={runDelete}
      />
    </Modal>
  );
};

const DetailRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  scrollContent: { padding: 20, paddingBottom: 32 },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.gray,
    marginBottom: 16,
  },
  amountBox: {
    backgroundColor: colors.greenLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  amountBoxOut: { backgroundColor: colors.amberLight },
  amountLabel: { fontSize: 12, color: colors.greenDark, opacity: 0.8 },
  amountLabelOut: { color: colors.amber },
  amountValue: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.greenDark,
    marginTop: 4,
  },
  amountValueOut: { color: colors.amber },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.grayLight,
    gap: 12,
  },
  rowLabel: { fontSize: 13, color: colors.gray, opacity: 0.7 },
  rowValue: {
    flex: 1,
    fontSize: 13,
    color: colors.gray,
    fontWeight: '600',
    textAlign: 'right',
  },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  closeBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.grayLight,
    alignItems: 'center',
  },
  closeBtnText: { color: colors.gray, fontWeight: '700' },
  deleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.red,
  },
  deleteBtnText: { color: colors.white, fontWeight: '700' },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.blue,
  },
  editBtnText: { color: colors.white, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
});
