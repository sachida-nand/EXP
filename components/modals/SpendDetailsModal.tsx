import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { formatCurrency } from '../../utils/formatCurrency';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import type { WalletSpend } from '../../types';

interface SpendDetailsModalProps {
  visible: boolean;
  spend: WalletSpend | null;
  currency?: string;
  onClose: () => void;
  onDelete?: (id: string) => Promise<void> | void;
  onEdit?: (spend: WalletSpend) => void;
}

export const SpendDetailsModal: React.FC<SpendDetailsModalProps> = ({
  visible,
  spend,
  currency = '₹',
  onClose,
  onDelete,
  onEdit,
}) => {
  const [deleting, setDeleting] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);

  if (!spend) return null;

  const confirmDelete = () => {
    if (!onDelete || deleting) return;
    setConfirmVisible(true);
  };

  const runDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete(spend.id);
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
          <Text style={styles.title}>Spend details</Text>

          <View style={styles.amountBox}>
            <Text style={styles.amountLabel}>Amount</Text>
            <Text style={styles.amountValue}>
              {formatCurrency(spend.amount, currency)}
            </Text>
            <Text style={styles.balanceLine}>
              Balance after · {formatCurrency(spend.balanceAfter, currency)}
            </Text>
          </View>

          <DetailRow label="Date" value={spend.date} />
          <DetailRow label="Paid to" value={spend.paidTo || '—'} />
          <DetailRow
            label="Type"
            value={
              spend.deductsWallet
                ? 'Deducted from wallet'
                : 'Tracked only (lent)'
            }
          />
          <DetailRow label="Month" value={`${spend.month} ${spend.year}`} />
          {spend.notes ? <DetailRow label="Notes" value={spend.notes} /> : null}

          {spend.receiptLink ? (
            <Pressable
              onPress={() => void Linking.openURL(spend.receiptLink)}
              style={styles.receiptLink}
            >
              <Ionicons
                name="image-outline"
                size={16}
                color={colors.blueDark}
              />
              <Text style={styles.receiptLinkText}>View receipt</Text>
            </Pressable>
          ) : (
            <Text style={styles.noReceipt}>No receipt attached</Text>
          )}

          <View style={styles.actionRow}>
            {onEdit ? (
              <Pressable
                onPress={() => {
                  if (deleting) return;
                  onEdit(spend);
                }}
                disabled={deleting}
                style={[styles.editBtn, deleting && styles.btnDisabled]}
              >
                <Ionicons
                  name="create-outline"
                  size={16}
                  color={colors.white}
                />
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
        title="Delete this spend?"
        message={`${spend.paidTo || 'Spend'} · ${formatCurrency(spend.amount, currency)} on ${spend.date}\n\nThis will remove the row from your sheet.`}
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
  scrollContent: {
    padding: 20,
    paddingBottom: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.gray,
    marginBottom: 16,
  },
  amountBox: {
    backgroundColor: colors.redLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  amountLabel: { fontSize: 12, color: colors.red, opacity: 0.8 },
  amountValue: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.red,
    marginTop: 4,
  },
  balanceLine: {
    fontSize: 12,
    color: colors.red,
    opacity: 0.75,
    marginTop: 6,
  },
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
  receiptLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.blueLight,
    padding: 12,
    borderRadius: 10,
    marginTop: 14,
  },
  receiptLinkText: {
    fontSize: 13,
    color: colors.blueDark,
    fontWeight: '700',
  },
  noReceipt: {
    fontSize: 12,
    color: colors.gray,
    opacity: 0.6,
    marginTop: 14,
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
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
