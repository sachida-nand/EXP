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
import type { FixedPayment } from '../../types';

interface FixedPaymentDetailsModalProps {
  visible: boolean;
  payment: FixedPayment | null;
  currency?: string;
  onClose: () => void;
  onDelete?: (id: string) => Promise<void> | void;
}

export const FixedPaymentDetailsModal: React.FC<FixedPaymentDetailsModalProps> = ({
  visible,
  payment,
  currency = '₹',
  onClose,
  onDelete,
}) => {
  const [deleting, setDeleting] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);

  if (!payment) return null;

  const isGiven = payment.paymentType === 'given';

  const confirmDelete = () => {
    if (!onDelete || deleting) return;
    setConfirmVisible(true);
  };

  const runDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete(payment.id);
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
          <Text style={styles.title}>{payment.bucketName}</Text>
          <Text style={styles.subtitle}>
            {isGiven ? 'Transfer' : 'Fixed payment'}
          </Text>

          <View style={styles.amountBox}>
            <Text style={styles.amountLabel}>Amount</Text>
            <Text style={styles.amountValue}>
              {formatCurrency(payment.amount, currency)}
            </Text>
          </View>

          <DetailRow label="Date" value={payment.datePaid || '—'} />
          <DetailRow label="Month" value={`${payment.month} ${payment.year}`} />
          <DetailRow
            label={isGiven ? 'Sent to' : 'Paid to'}
            value={payment.paidTo || '—'}
          />
          <DetailRow
            label="Type"
            value={isGiven ? 'Given' : 'Paid'}
          />
          {payment.notes ? <DetailRow label="Notes" value={payment.notes} /> : null}

          {payment.receiptLink ? (
            <Pressable
              onPress={() => void Linking.openURL(payment.receiptLink)}
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
        title={isGiven ? 'Delete this transfer?' : 'Delete this payment?'}
        message={`${payment.bucketName} · ${formatCurrency(payment.amount, currency)} on ${payment.datePaid || `${payment.month} ${payment.year}`}\n\nThis will remove the row from your sheet.`}
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
  },
  subtitle: {
    fontSize: 13,
    color: colors.gray,
    opacity: 0.7,
    marginTop: 2,
    marginBottom: 14,
  },
  amountBox: {
    backgroundColor: colors.purpleLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  amountLabel: { fontSize: 12, color: colors.purpleDark, opacity: 0.8 },
  amountValue: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.purpleDark,
    marginTop: 4,
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
  btnDisabled: { opacity: 0.5 },
});
