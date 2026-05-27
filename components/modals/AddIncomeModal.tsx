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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import dayjs from 'dayjs';
import { colors } from '../../constants/colors';
import { fromSheetDate } from '../../utils/dateHelpers';
import type { IncomeEntry, IncomeDirection } from '../../types';

export interface IncomeInput {
  amount: number;
  paidBy: string;
  notes: string;
  date: Date;
  direction: IncomeDirection;
}

interface AddIncomeModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (v: IncomeInput) => Promise<void> | void;
  paidBySuggestions?: string[];
  currency?: string;
  editing?: IncomeEntry | null;
}

export const AddIncomeModal: React.FC<AddIncomeModalProps> = ({
  visible,
  onClose,
  onSubmit,
  paidBySuggestions = [],
  currency = '₹',
  editing,
}) => {
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState<Date>(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [direction, setDirection] = useState<IncomeDirection>('in');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (editing) {
      setAmount(String(editing.amount));
      setPaidBy(editing.paidBy);
      setNotes(editing.notes);
      setDate(fromSheetDate(editing.date).toDate());
      setDirection(editing.direction);
    } else {
      setAmount('');
      setPaidBy('');
      setNotes('');
      setDate(new Date());
      setDirection('in');
    }
    setShowDatePicker(false);
  }, [visible, editing]);

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
  const canSubmit = validNumber && paidBy.trim().length > 0;

  const submit = async () => {
    Keyboard.dismiss();
    if (!canSubmit) return;
    setBusy(true);
    try {
      await onSubmit({
        amount: parsed,
        paidBy: paidBy.trim(),
        notes: notes.trim(),
        date,
        direction,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const isEditing = Boolean(editing);
  const isOut = direction === 'out';
  const primaryLabel = busy
    ? 'Saving…'
    : isEditing
      ? 'Save changes'
      : isOut
        ? 'Add return'
        : 'Add income';

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
            <Text style={styles.title}>
              {isEditing ? 'Edit entry' : isOut ? 'Add return' : 'Add income'}
            </Text>

            <View style={styles.directionRow}>
              {(['in', 'out'] as const).map((d) => {
                const active = direction === d;
                return (
                  <Pressable
                    key={d}
                    onPress={() => setDirection(d)}
                    style={[
                      styles.directionBtn,
                      active && (d === 'in' ? styles.directionBtnInActive : styles.directionBtnOutActive),
                    ]}
                  >
                    <Ionicons
                      name={d === 'in' ? 'arrow-down' : 'arrow-up'}
                      size={14}
                      color={active ? colors.white : colors.gray}
                    />
                    <Text
                      style={[
                        styles.directionText,
                        active && styles.directionTextActive,
                      ]}
                    >
                      {d === 'in' ? 'Received' : 'Returned'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>
              Amount ({currency}) <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="0"
              autoFocus
            />

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

            <Text style={styles.label}>
              {isOut ? 'Paid to' : 'Paid by'} <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={paidBy}
              onChangeText={setPaidBy}
              placeholder="e.g. Father, Brother, Friend Raj"
            />
            {(() => {
              const needle = paidBy.trim().toLowerCase();
              const matches = paidBySuggestions
                .filter((v) => {
                  if (v.toLowerCase() === needle) return false;
                  if (!needle) return true;
                  return v.toLowerCase().includes(needle);
                })
                .slice(0, 12);
              if (matches.length === 0) return null;
              return (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipRow}
                  keyboardShouldPersistTaps="handled"
                >
                  {matches.map((m) => (
                    <Pressable
                      key={m}
                      onPress={() => setPaidBy(m)}
                      style={styles.suggestChip}
                    >
                      <Text style={styles.suggestChipText}>{m}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              );
            })()}

            <Text style={styles.label}>
              {isOut ? 'Remark (optional)' : 'Notes (optional)'}
            </Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder={
                isOut
                  ? 'e.g. Repaid loan, refund'
                  : 'e.g. Diwali gift, repaid loan'
              }
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
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
                  isOut ? styles.btnReturn : styles.btnPrimary,
                  (!canSubmit || busy) && styles.btnDisabled,
                ]}
                disabled={!canSubmit || busy}
              >
                <Text style={styles.btnPrimaryText}>{primaryLabel}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
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
  scrollContent: { padding: 20, paddingBottom: 32 },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.gray,
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    color: colors.gray,
    opacity: 0.7,
    marginBottom: 4,
    marginTop: 10,
  },
  required: { color: colors.red, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderColor: colors.grayLight,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: colors.gray,
  },
  notesInput: { minHeight: 70 },
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
  chipRow: { gap: 8, paddingVertical: 4 },
  suggestChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.blueLight,
    borderWidth: 1,
    borderColor: colors.blue,
  },
  suggestChipText: { fontSize: 12, color: colors.blueDark, fontWeight: '600' },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnPrimary: { backgroundColor: colors.green },
  btnReturn: { backgroundColor: colors.amber },
  btnPrimaryText: { color: colors.white, fontWeight: '700' },
  btnGhost: { backgroundColor: colors.grayLight },
  btnGhostText: { color: colors.gray, fontWeight: '600' },
  btnDisabled: { opacity: 0.5 },
  directionRow: {
    flexDirection: 'row',
    backgroundColor: colors.grayLight,
    borderRadius: 10,
    padding: 3,
    gap: 3,
    marginBottom: 4,
  },
  directionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
  },
  directionBtnInActive: { backgroundColor: colors.green },
  directionBtnOutActive: { backgroundColor: colors.amber },
  directionText: { fontSize: 13, color: colors.gray, fontWeight: '700' },
  directionTextActive: { color: colors.white },
});
