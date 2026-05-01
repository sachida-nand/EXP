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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import dayjs from 'dayjs';
import { colors } from '../../constants/colors';

const MAX_WIDTH = 1080;
const COMPRESS_QUALITY = 0.35;

export interface AttachedImage {
  uri: string;
  mimeType: string;
  fileName: string;
}

export interface SpendInput {
  amount: number;
  paidTo: string;
  purpose: string;
  notes: string;
  date: Date;
  image?: AttachedImage;
}

interface AddSpendModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (v: SpendInput) => Promise<void> | void;
  initialPurpose?: string;
  purposes?: string[];
  paidToSuggestions?: string[];
  currency?: string;
}

export const AddSpendModal: React.FC<AddSpendModalProps> = ({
  visible,
  onClose,
  onSubmit,
  initialPurpose = '',
  purposes = [],
  paidToSuggestions = [],
  currency = '₹',
}) => {
  const [amount, setAmount] = useState('');
  const [paidTo, setPaidTo] = useState('');
  const [purpose, setPurpose] = useState(initialPurpose);
  const [notes, setNotes] = useState('');
  const [image, setImage] = useState<AttachedImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState<Date>(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    if (visible) {
      setAmount('');
      setPaidTo('');
      setPurpose(initialPurpose);
      setNotes('');
      setImage(null);
      setDate(new Date());
      setShowDatePicker(false);
    }
  }, [visible, initialPurpose]);

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
  const canSubmit = validNumber && purpose.trim().length > 0;

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
        fileName: `spend-${Date.now()}.jpg`,
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
        purpose: purpose.trim(),
        notes: notes.trim(),
        date,
        image: image ?? undefined,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const primaryLabel = busy
    ? image
      ? 'Uploading & saving…'
      : 'Saving…'
    : 'Add spend';

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
            <Text style={styles.title}>Add spend</Text>

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

            <Text style={styles.label}>Paid to (optional)</Text>
            <TextInput
              style={styles.input}
              value={paidTo}
              onChangeText={setPaidTo}
              placeholder="e.g. Ride, Market, Plumber"
            />
            {(() => {
              const needle = paidTo.trim().toLowerCase();
              const matches = paidToSuggestions
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
                      onPress={() => setPaidTo(m)}
                      style={styles.suggestChip}
                    >
                      <Text style={styles.suggestChipText}>{m}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              );
            })()}

            <Text style={styles.label}>
              Purpose <Text style={styles.required}>*</Text>
            </Text>
            {purposes.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
                keyboardShouldPersistTaps="handled"
              >
                {purposes.map((p) => {
                  const active = purpose.trim().toLowerCase() === p.toLowerCase();
                  return (
                    <Pressable
                      key={p}
                      onPress={() => setPurpose(active ? '' : p)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text
                        style={[styles.chipText, active && styles.chipTextActive]}
                      >
                        {p}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}
            <TextInput
              style={[styles.input, purposes.length > 0 && { marginTop: 8 }]}
              value={purpose}
              onChangeText={setPurpose}
              placeholder="e.g. Repair"
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
                  styles.btnPrimary,
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
  label: { fontSize: 12, color: colors.gray, opacity: 0.7, marginBottom: 4, marginTop: 10 },
  required: { color: colors.red, fontWeight: '700' },
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
  chipRow: { gap: 8, paddingVertical: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: colors.grayLight,
  },
  chipActive: { backgroundColor: colors.green },
  chipText: { fontSize: 12, color: colors.gray, fontWeight: '600' },
  chipTextActive: { color: colors.white, fontWeight: '700' },
  suggestChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.blueLight,
    borderWidth: 1,
    borderColor: colors.blue,
  },
  suggestChipText: { fontSize: 12, color: colors.blueDark, fontWeight: '600' },
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
});
