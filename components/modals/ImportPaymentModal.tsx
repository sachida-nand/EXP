import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import dayjs from 'dayjs';
import { colors } from '../../constants/colors';
import { matchBucket } from '../../services/ocr/upiParser';
import type {
  Allocation,
  FieldConfidence,
  ParsedPayment,
} from '../../types';

export interface ImportSubmitPayload {
  amount: number;
  paidTo: string;
  message: string;
  txnId: string;
  date: Date;
  target: 'wallet' | 'fixed';
  bucketName?: string;
  bucketType?: string;
  deductsWallet: boolean;
}

interface ImportPaymentModalProps {
  visible: boolean;
  screenshotUri: string;
  parsed: ParsedPayment;
  allocations: Allocation[];
  initialTarget?: 'wallet' | 'fixed';
  initialBucketName?: string;
  isDraft?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onSaveDraft: (payload: ImportSubmitPayload) => Promise<void> | void;
  onSave: (payload: ImportSubmitPayload) => Promise<void> | void;
  currency?: string;
}

const flagBg = (c: FieldConfidence) =>
  c === 'missing' || c === 'guess' ? colors.amberLight : 'transparent';

export const ImportPaymentModal: React.FC<ImportPaymentModalProps> = ({
  visible,
  screenshotUri,
  parsed,
  allocations,
  initialTarget,
  initialBucketName,
  isDraft = false,
  busy = false,
  onCancel,
  onSaveDraft,
  onSave,
  currency = '₹',
}) => {
  const fixedBuckets = useMemo(
    () => allocations.filter((a) => a.bucketType !== 'wallet'),
    [allocations],
  );

  const suggestion = useMemo(() => {
    if (initialTarget) {
      return {
        target: initialTarget,
        bucketName: initialBucketName ?? '',
      };
    }
    const matched = matchBucket(parsed.message, fixedBuckets);
    if (matched) {
      return {
        target: 'fixed' as const,
        bucketName: matched.bucketName,
      };
    }
    return { target: 'wallet' as const, bucketName: '' };
  }, [parsed.message, fixedBuckets, initialTarget, initialBucketName]);

  const [amountStr, setAmountStr] = useState('');
  const [paidTo, setPaidTo] = useState('');
  const [message, setMessage] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [target, setTarget] = useState<'wallet' | 'fixed'>('wallet');
  const [bucketName, setBucketName] = useState('');
  const [showBucketPicker, setShowBucketPicker] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [deductsWallet, setDeductsWallet] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setAmountStr(parsed.amount > 0 ? String(parsed.amount) : '');
    setPaidTo(parsed.paidTo);
    setMessage(parsed.message);
    setDate(parsed.date);
    setTarget(suggestion.target);
    setBucketName(suggestion.bucketName);
    setShowDatePicker(false);
    setShowBucketPicker(false);
    setShowRaw(false);
    setDeductsWallet(true);
  }, [visible, parsed, suggestion]);

  const onChangeDate = (e: DateTimePickerEvent, picked?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (e.type === 'dismissed' || !picked) return;
    setDate(picked);
  };

  const buildPayload = (): ImportSubmitPayload | null => {
    const amount = Number(amountStr.replace(/,/g, ''));
    if (!amount || isNaN(amount) || amount <= 0) return null;
    const bucket =
      target === 'fixed'
        ? fixedBuckets.find((b) => b.bucketName === bucketName)
        : undefined;
    return {
      amount,
      paidTo: paidTo.trim(),
      message: message.trim(),
      txnId: parsed.txnId,
      date,
      target,
      bucketName: target === 'fixed' ? bucket?.bucketName : undefined,
      bucketType: target === 'fixed' ? bucket?.bucketType : undefined,
      deductsWallet,
    };
  };

  const canSave = (() => {
    if (busy) return false;
    if (!amountStr.trim()) return false;
    const num = Number(amountStr.replace(/,/g, ''));
    if (!num || isNaN(num) || num <= 0) return false;
    if (target === 'fixed' && !bucketName) return false;
    return true;
  })();

  const handleSave = async () => {
    const p = buildPayload();
    if (!p) return;
    await onSave(p);
  };
  const handleSaveDraft = async () => {
    const p = buildPayload();
    if (!p) return;
    await onSaveDraft(p);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={busy ? undefined : onCancel}
      statusBarTranslucent
    >
      <Pressable
        style={styles.backdrop}
        onPress={busy ? undefined : onCancel}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetWrap}
      >
        <View style={styles.sheet}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <Text style={styles.title}>
                {isDraft ? 'Edit draft' : 'Import payment'}
              </Text>
              <View style={styles.sourceChip}>
                <Text style={styles.sourceChipText}>
                  {parsed.source === 'unknown' ? 'UPI' : parsed.source.toUpperCase()}
                </Text>
              </View>
            </View>

            {screenshotUri ? (
              <Image
                source={{ uri: screenshotUri }}
                style={styles.thumb}
                resizeMode="contain"
              />
            ) : null}

            <Text style={styles.label}>Amount</Text>
            <View
              style={[
                styles.inputBox,
                { backgroundColor: flagBg(parsed.confidence.amount) },
              ]}
            >
              <Text style={styles.currency}>{currency}</Text>
              <TextInput
                style={styles.amountInput}
                value={amountStr}
                onChangeText={setAmountStr}
                placeholder="0"
                placeholderTextColor={colors.gray}
                keyboardType="numeric"
                editable={!busy}
              />
            </View>

            <Text style={styles.label}>Paid to</Text>
            <View
              style={[
                styles.inputBox,
                { backgroundColor: flagBg(parsed.confidence.paidTo) },
              ]}
            >
              <TextInput
                style={styles.input}
                value={paidTo}
                onChangeText={setPaidTo}
                placeholder="Recipient name"
                placeholderTextColor={colors.gray}
                editable={!busy}
              />
            </View>

            <Text style={styles.label}>Date</Text>
            <Pressable
              onPress={() => setShowDatePicker(true)}
              style={[
                styles.dateBtn,
                { backgroundColor: flagBg(parsed.confidence.date) },
              ]}
            >
              <Ionicons
                name="calendar-outline"
                size={16}
                color={colors.blueDark}
              />
              <Text style={styles.dateBtnText}>
                {dayjs(date).format('DD MMM YYYY · h:mm a')}
              </Text>
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

            <Text style={styles.label}>Notes</Text>
            <View
              style={[
                styles.inputBox,
                { backgroundColor: flagBg(parsed.confidence.message) },
              ]}
            >
              <TextInput
                style={styles.input}
                value={message}
                onChangeText={setMessage}
                placeholder="No notes"
                placeholderTextColor={colors.gray}
                editable={!busy}
              />
            </View>

            <Text style={styles.label}>Save as</Text>
            <View style={styles.targetRow}>
              <Pressable
                onPress={() => setTarget('wallet')}
                style={[
                  styles.targetBtn,
                  target === 'wallet' && styles.targetBtnActive,
                ]}
                disabled={busy}
              >
                <Ionicons
                  name="wallet-outline"
                  size={16}
                  color={target === 'wallet' ? colors.white : colors.gray}
                />
                <Text
                  style={[
                    styles.targetBtnText,
                    target === 'wallet' && styles.targetBtnTextActive,
                  ]}
                >
                  Wallet spend
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setTarget('fixed')}
                style={[
                  styles.targetBtn,
                  target === 'fixed' && styles.targetBtnActive,
                ]}
                disabled={busy}
              >
                <Ionicons
                  name="receipt-outline"
                  size={16}
                  color={target === 'fixed' ? colors.white : colors.gray}
                />
                <Text
                  style={[
                    styles.targetBtnText,
                    target === 'fixed' && styles.targetBtnTextActive,
                  ]}
                >
                  Fixed payment
                </Text>
              </Pressable>
            </View>

            {target === 'wallet' ? (
              <View style={styles.deductRow}>
                <View style={styles.deductTextWrap}>
                  <Text style={styles.deductTitle}>
                    Deduct from wallet balance
                  </Text>
                  <Text style={styles.deductHint}>
                    {deductsWallet
                      ? 'On — counted as a real expense.'
                      : 'Off — tracked only (e.g. cash you lent).'}
                  </Text>
                </View>
                <Switch
                  value={deductsWallet}
                  onValueChange={setDeductsWallet}
                  trackColor={{ false: colors.grayLight, true: colors.green }}
                  thumbColor={colors.white}
                  disabled={busy}
                />
              </View>
            ) : null}

            {target === 'fixed' ? (
              <>
                <Text style={styles.label}>Bucket</Text>
                <Pressable
                  onPress={() => setShowBucketPicker((v) => !v)}
                  style={styles.bucketBtn}
                >
                  <Text style={styles.bucketBtnText}>
                    {bucketName || 'Select bucket'}
                  </Text>
                  <Ionicons
                    name={showBucketPicker ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.gray}
                  />
                </Pressable>
                {showBucketPicker ? (
                  <View style={styles.bucketList}>
                    {fixedBuckets.length === 0 ? (
                      <Text style={styles.bucketEmpty}>
                        No fixed buckets allocated for this month.
                      </Text>
                    ) : (
                      fixedBuckets.map((b) => (
                        <Pressable
                          key={b.bucketName}
                          style={[
                            styles.bucketItem,
                            bucketName === b.bucketName && styles.bucketItemSel,
                          ]}
                          onPress={() => {
                            setBucketName(b.bucketName);
                            setShowBucketPicker(false);
                          }}
                        >
                          <Text
                            style={[
                              styles.bucketItemText,
                              bucketName === b.bucketName &&
                                styles.bucketItemTextSel,
                            ]}
                          >
                            {b.bucketName}
                          </Text>
                          {bucketName === b.bucketName ? (
                            <Ionicons
                              name="checkmark"
                              size={16}
                              color={colors.blue}
                            />
                          ) : null}
                        </Pressable>
                      ))
                    )}
                  </View>
                ) : null}
              </>
            ) : null}

            <Pressable
              onPress={() => setShowRaw((v) => !v)}
              style={styles.rawToggle}
              hitSlop={6}
            >
              <Ionicons
                name={showRaw ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={colors.gray}
              />
              <Text style={styles.rawToggleText}>
                {showRaw ? 'Hide OCR text' : 'Show OCR text'}
              </Text>
            </Pressable>
            {showRaw ? (
              <View style={styles.rawBox}>
                <Text style={styles.rawText} selectable>
                  {parsed.raw || '(no text recognized)'}
                </Text>
              </View>
            ) : null}

            <View style={styles.actions}>
              <Pressable
                onPress={onCancel}
                disabled={busy}
                style={[styles.btn, styles.btnGhost, busy && styles.btnDisabled]}
              >
                <Text style={styles.btnGhostText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveDraft}
                disabled={!canSave}
                style={[
                  styles.btn,
                  styles.btnDraft,
                  !canSave && styles.btnDisabled,
                ]}
              >
                <Ionicons
                  name="bookmark-outline"
                  size={14}
                  color={colors.amber}
                />
                <Text style={styles.btnDraftText}>
                  {busy ? '…' : 'Save draft'}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={!canSave}
                style={[
                  styles.btn,
                  styles.btnPrimary,
                  !canSave && styles.btnDisabled,
                ]}
              >
                <Text style={styles.btnPrimaryText}>
                  {busy ? 'Saving…' : 'Save'}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheetWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
  },
  scroll: {
    padding: 20,
    paddingBottom: 32,
    gap: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.gray,
  },
  sourceChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: colors.blueLight,
  },
  sourceChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.blueDark,
    letterSpacing: 0.4,
  },
  thumb: {
    height: 160,
    borderRadius: 14,
    marginBottom: 12,
    backgroundColor: colors.grayLight,
  },
  label: {
    fontSize: 11,
    color: colors.gray,
    opacity: 0.6,
    marginTop: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.grayLight,
    marginTop: 4,
  },
  currency: {
    fontSize: 16,
    color: colors.gray,
    fontWeight: '700',
  },
  amountInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.gray,
    padding: 0,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.gray,
    padding: 0,
  },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.blueLight,
    marginTop: 4,
  },
  dateBtnText: {
    fontSize: 13,
    color: colors.blueDark,
    fontWeight: '700',
  },
  targetRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  targetBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.grayLight,
  },
  targetBtnActive: {
    backgroundColor: colors.blue,
  },
  targetBtnText: {
    fontSize: 13,
    color: colors.gray,
    fontWeight: '700',
  },
  targetBtnTextActive: {
    color: colors.white,
  },
  bucketBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.grayLight,
    marginTop: 4,
  },
  bucketBtnText: {
    fontSize: 14,
    color: colors.gray,
    fontWeight: '600',
  },
  bucketList: {
    borderRadius: 10,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.grayLight,
    marginTop: 6,
    overflow: 'hidden',
  },
  bucketItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bucketItemSel: {
    backgroundColor: colors.blueLight,
  },
  bucketItemText: {
    fontSize: 13,
    color: colors.gray,
  },
  bucketItemTextSel: {
    color: colors.blueDark,
    fontWeight: '700',
  },
  bucketEmpty: {
    fontSize: 12,
    color: colors.gray,
    opacity: 0.6,
    padding: 14,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnGhost: {
    backgroundColor: colors.grayLight,
  },
  btnGhostText: {
    color: colors.gray,
    fontWeight: '700',
    fontSize: 13,
  },
  btnDraft: {
    backgroundColor: colors.amberLight,
  },
  btnDraftText: {
    color: colors.amber,
    fontWeight: '700',
    fontSize: 13,
  },
  btnPrimary: {
    backgroundColor: colors.blue,
  },
  btnPrimaryText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  rawToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    alignSelf: 'flex-start',
  },
  rawToggleText: {
    fontSize: 11,
    color: colors.gray,
    opacity: 0.6,
    fontWeight: '600',
  },
  rawBox: {
    marginTop: 6,
    padding: 10,
    borderRadius: 8,
    backgroundColor: colors.grayLight,
    maxHeight: 180,
  },
  rawText: {
    fontSize: 11,
    color: colors.gray,
    fontFamily: 'monospace',
    lineHeight: 15,
  },
  deductRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.grayLight,
  },
  deductTextWrap: { flex: 1 },
  deductTitle: { fontSize: 13, color: colors.gray, fontWeight: '700' },
  deductHint: {
    fontSize: 11,
    color: colors.gray,
    opacity: 0.7,
    marginTop: 2,
  },
});
