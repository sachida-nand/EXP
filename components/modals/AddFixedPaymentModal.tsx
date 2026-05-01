import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import dayjs from 'dayjs';
import { colors } from '../../constants/colors';
import { formatCurrency } from '../../utils/formatCurrency';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import type { FixedPayment } from '../../types';

const MAX_WIDTH = 1080;
const COMPRESS_QUALITY = 0.35;

export interface AttachedImage {
  uri: string;
  mimeType: string;
  fileName: string;
}

export interface FixedPaymentInput {
  amount: number;
  paidTo: string;
  notes: string;
  date: Date;
  image?: AttachedImage;
}

interface AddFixedPaymentModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (v: FixedPaymentInput) => Promise<void> | void;
  onDeletePayment?: (id: string) => Promise<void> | void;
  bucketName: string;
  bucketType: string;
  allocated: number;
  totalPaid: number;
  history: FixedPayment[];
  currency?: string;
}

export const AddFixedPaymentModal: React.FC<AddFixedPaymentModalProps> = ({
  visible,
  onClose,
  onSubmit,
  onDeletePayment,
  bucketName,
  bucketType,
  allocated,
  totalPaid,
  history,
  currency = '₹',
}) => {
  const verbLabel = bucketType === 'give' ? 'transfer' : 'payment';
  const remaining = Math.max(allocated - totalPaid, 0);
  const [amount, setAmount] = useState('');
  const [paidTo, setPaidTo] = useState('');
  const [notes, setNotes] = useState('');
  const [image, setImage] = useState<AttachedImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState<Date>(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<FixedPayment | null>(null);
  const [deletingPayment, setDeletingPayment] = useState(false);

  useEffect(() => {
    if (visible) {
      setAmount(remaining > 0 ? String(remaining) : '');
      setPaidTo('');
      setNotes('');
      setImage(null);
      setDate(new Date());
      setShowDatePicker(false);
      setPendingDelete(null);
      setDeletingPayment(false);
    }
  }, [visible, remaining]);

  const confirmDeletePayment = (p: FixedPayment) => {
    if (!onDeletePayment || deletingPayment) return;
    setPendingDelete(p);
  };

  const runDeletePayment = async () => {
    if (!onDeletePayment || !pendingDelete) return;
    setDeletingPayment(true);
    try {
      await onDeletePayment(pendingDelete.id);
      setPendingDelete(null);
    } catch (err) {
      setPendingDelete(null);
      const msg = err instanceof Error ? err.message : 'Could not delete';
      Alert.alert('Delete failed', msg);
    } finally {
      setDeletingPayment(false);
    }
  };

  const onChangeDate = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS !== 'ios') setShowDatePicker(false);
    if (event.type === 'dismissed') return;
    if (selected) {
      const today = new Date();
      const capped = selected > today ? today : selected;
      setDate(capped);
    }
  };

  const parsed = Number(amount);
  const validNumber = Number.isFinite(parsed) && parsed > 0;
  const exceeds = validNumber && parsed > remaining;
  const canSubmit = validNumber && !exceeds && remaining > 0;

  const pickImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Permission needed',
          'Allow photo library access to attach a screenshot.',
        );
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
      });
      if (res.canceled) return;
      const a = res.assets[0];

      const actions = a.width && a.width > MAX_WIDTH
        ? [{ resize: { width: MAX_WIDTH } }]
        : [];
      const compressed = await ImageManipulator.manipulateAsync(a.uri, actions, {
        compress: COMPRESS_QUALITY,
        format: ImageManipulator.SaveFormat.JPEG,
      });

      setImage({
        uri: compressed.uri,
        mimeType: 'image/jpeg',
        fileName: `receipt-${Date.now()}.jpg`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not pick image';
      Alert.alert('Image picker failed', msg);
    }
  };

  const submit = async () => {
    Keyboard.dismiss();
    if (!canSubmit) return;
    setBusy(true);
    try {
      await onSubmit({
        amount: parsed,
        paidTo: paidTo.trim(),
        notes: notes.trim(),
        date,
        image: image ?? undefined,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const fillRemaining = () => {
    if (remaining > 0) setAmount(String(remaining));
  };

  const verb = bucketType === 'give' ? 'send' : 'pay';
  const primaryLabel = busy
    ? image
      ? 'Uploading & saving…'
      : 'Saving…'
    : bucketType === 'give'
      ? 'Record transfer'
      : 'Record payment';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <Text style={styles.title}>{bucketName}</Text>
            <Text style={styles.subtitle}>
              {remaining > 0
                ? `How much did you ${verb}?`
                : 'All payments recorded for this month'}
            </Text>

            <View style={styles.progressBox}>
              <View style={styles.progressRow}>
                <Text style={styles.progressLabel}>Allocated</Text>
                <Text style={styles.progressValue}>
                  {formatCurrency(allocated, currency)}
                </Text>
              </View>
              <View style={styles.progressRow}>
                <Text style={styles.progressLabel}>Already paid</Text>
                <Text style={styles.progressValue}>
                  {formatCurrency(totalPaid, currency)}
                </Text>
              </View>
              <View style={styles.progressRow}>
                <Text style={[styles.progressLabel, styles.progressRemainLabel]}>
                  Remaining
                </Text>
                <Text
                  style={[
                    styles.progressValue,
                    {
                      color:
                        remaining > 0 ? colors.amber : colors.greenDark,
                    },
                  ]}
                >
                  {formatCurrency(remaining, currency)}
                </Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>
              Payments {history.length > 0 ? `(${history.length})` : ''}
            </Text>
            {history.length === 0 ? (
              <View style={styles.historyEmpty}>
                <Text style={styles.historyEmptyText}>
                  No payments yet this month.
                </Text>
              </View>
            ) : (
              <View style={styles.historyList}>
                {history.map((h) => (
                  <View key={h.id} style={styles.historyItem}>
                    <View style={styles.historyTopRow}>
                      <Text style={styles.historyAmount}>
                        {formatCurrency(h.amount, currency)}
                      </Text>
                      <View style={styles.historyTopRight}>
                        <Text style={styles.historyDate}>{h.datePaid}</Text>
                        {onDeletePayment ? (
                          <Pressable
                            onPress={() => confirmDeletePayment(h)}
                            hitSlop={8}
                            style={styles.historyDelete}
                          >
                            <Ionicons
                              name="trash-outline"
                              size={16}
                              color={colors.red}
                            />
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                    {h.paidTo ? (
                      <Text style={styles.historyMeta}>
                        {bucketType === 'give' ? 'To' : 'Paid to'}: {h.paidTo}
                      </Text>
                    ) : null}
                    {h.notes ? (
                      <Text style={styles.historyMeta}>Notes: {h.notes}</Text>
                    ) : null}
                    {h.receiptLink ? (
                      <Pressable
                        onPress={() => void Linking.openURL(h.receiptLink)}
                        style={styles.receiptLink}
                      >
                        <Ionicons
                          name="image-outline"
                          size={14}
                          color={colors.blueDark}
                        />
                        <Text style={styles.receiptLinkText}>View receipt</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </View>
            )}

            {remaining <= 0 ? (
              <View style={styles.settledBanner}>
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color={colors.greenDark}
                />
                <Text style={styles.settledText}>
                  This bucket is settled for this month.
                </Text>
              </View>
            ) : null}

            {remaining > 0 ? (
              <>
                <Text style={styles.sectionTitle}>Add another payment</Text>

                <Text style={styles.label}>Date</Text>
                <Pressable
                  onPress={() => setShowDatePicker(true)}
                  style={styles.dateRow}
                >
                  <Ionicons name="calendar-outline" size={18} color={colors.blueDark} />
                  <Text style={styles.dateText}>
                    {dayjs(date).format('DD MMM YYYY')}
                  </Text>
                  <Text style={styles.dateHint}>Tap to change</Text>
                </Pressable>
                {showDatePicker ? (
                  <DateTimePicker
                    value={date}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    maximumDate={new Date()}
                    onChange={onChangeDate}
                  />
                ) : null}

                <Text style={styles.label}>Amount ({currency})</Text>
            <TextInput
              style={[styles.input, exceeds && styles.inputError]}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="0"
              autoFocus
              editable={remaining > 0}
            />
            {exceeds ? (
              <Text style={styles.errorText}>
                Can't exceed remaining ({formatCurrency(remaining, currency)}).
                Increase the allocation in Salary if you need to send more.
              </Text>
            ) : null}
            {remaining > 0 ? (
              <Pressable onPress={fillRemaining} style={styles.fillBtn}>
                <Text style={styles.fillBtnText}>
                  Fill remaining ({formatCurrency(remaining, currency)})
                </Text>
              </Pressable>
            ) : null}

            <Text style={styles.label}>
              {bucketType === 'give' ? 'Sent to' : 'Paid to'} (optional)
            </Text>
            <TextInput
              style={styles.input}
              value={paidTo}
              onChangeText={setPaidTo}
              placeholder={bucketType === 'give' ? 'e.g. Brother' : 'e.g. Landlord'}
            />

            <Text style={styles.label}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Transaction ID, reference, etc."
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <Text style={styles.label}>Screenshot (optional)</Text>
            {image ? (
              <View style={styles.imageCard}>
                <Image source={{ uri: image.uri }} style={styles.imagePreview} />
                <View style={styles.imageMeta}>
                  <Text style={styles.imageName} numberOfLines={1}>
                    {image.fileName}
                  </Text>
                  <Text style={styles.imageHint}>
                    Compressed · will upload on save
                  </Text>
                </View>
                <Pressable onPress={() => setImage(null)} style={styles.imageRemove}>
                  <Ionicons name="close" size={18} color={colors.gray} />
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={pickImage} style={styles.attachBtn} disabled={busy}>
                <Ionicons name="image-outline" size={18} color={colors.blueDark} />
                <Text style={styles.attachBtnText}>Attach screenshot</Text>
              </Pressable>
            )}
              </>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              {remaining > 0 ? (
                <>
                  <Pressable
                    onPress={onClose}
                    style={[styles.btn, styles.btnGhost]}
                    disabled={busy}
                  >
                    <Text style={styles.btnGhostText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={submit}
                    style={[
                      styles.btn,
                      styles.btnPrimary,
                      (!canSubmit || busy) && styles.btnDisabled,
                    ]}
                    disabled={!canSubmit || busy}
                  >
                    <Text style={styles.btnPrimaryText}>{primaryLabel}</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable
                  onPress={onClose}
                  style={[styles.btn, styles.btnPrimary]}
                >
                  <Text style={styles.btnPrimaryText}>Close</Text>
                </Pressable>
              )}
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      <ConfirmDialog
        visible={pendingDelete !== null}
        title={`Delete this ${verbLabel}?`}
        message={
          pendingDelete
            ? `${formatCurrency(pendingDelete.amount, currency)} on ${pendingDelete.datePaid || `${pendingDelete.month} ${pendingDelete.year}`}\n\nThis will remove the row from your sheet.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        busy={deletingPayment}
        icon="trash-outline"
        onCancel={() => setPendingDelete(null)}
        onConfirm={runDeletePayment}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 32,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.gray },
  subtitle: {
    fontSize: 13,
    color: colors.gray,
    opacity: 0.7,
    marginTop: 4,
    marginBottom: 16,
  },
  progressBox: {
    backgroundColor: colors.grayLight,
    borderRadius: 12,
    padding: 12,
    gap: 6,
    marginBottom: 8,
  },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontSize: 12, color: colors.gray, opacity: 0.7 },
  progressRemainLabel: { fontWeight: '700', opacity: 1 },
  progressValue: { fontSize: 13, color: colors.gray, fontWeight: '700' },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.gray,
    marginTop: 16,
    marginBottom: 8,
  },
  historyEmpty: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.grayLight,
  },
  historyEmptyText: {
    fontSize: 12,
    color: colors.gray,
    opacity: 0.7,
    textAlign: 'center',
  },
  historyList: { gap: 8 },
  historyItem: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.grayLight,
    gap: 4,
  },
  historyTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyAmount: { fontSize: 15, fontWeight: '800', color: colors.gray },
  historyDate: { fontSize: 12, color: colors.gray, opacity: 0.7 },
  historyTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  historyDelete: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.redLight,
  },
  historyMeta: { fontSize: 12, color: colors.gray, opacity: 0.8 },
  receiptLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  receiptLinkText: {
    fontSize: 12,
    color: colors.blueDark,
    fontWeight: '700',
  },
  settledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.greenLight,
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  settledText: { fontSize: 13, color: colors.greenDark, fontWeight: '700' },
  label: { fontSize: 12, color: colors.gray, opacity: 0.7, marginBottom: 4, marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: colors.grayLight,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: colors.gray,
  },
  notesInput: {
    minHeight: 70,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.grayLight,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.blueLight,
  },
  dateText: {
    fontSize: 15,
    color: colors.blueDark,
    fontWeight: '700',
    flex: 1,
  },
  dateHint: {
    fontSize: 11,
    color: colors.blueDark,
    opacity: 0.7,
    fontWeight: '600',
  },
  fillBtn: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: colors.amberLight,
  },
  fillBtnText: { fontSize: 12, color: colors.amber, fontWeight: '700' },
  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.blue,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.blueLight,
  },
  attachBtnText: { color: colors.blueDark, fontWeight: '700', fontSize: 13 },
  imageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    backgroundColor: colors.grayLight,
    borderRadius: 10,
  },
  imagePreview: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  imageMeta: { flex: 1 },
  imageName: { fontSize: 13, color: colors.gray, fontWeight: '700' },
  imageHint: { fontSize: 11, color: colors.gray, opacity: 0.7, marginTop: 2 },
  imageRemove: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnPrimary: { backgroundColor: colors.green },
  btnPrimaryText: { color: colors.white, fontWeight: '700' },
  btnGhost: { backgroundColor: colors.grayLight },
  btnGhostText: { color: colors.gray, fontWeight: '600' },
  btnDisabled: { opacity: 0.5 },
  inputError: { borderColor: colors.red },
  errorText: {
    fontSize: 12,
    color: colors.red,
    marginTop: 6,
  },
});
