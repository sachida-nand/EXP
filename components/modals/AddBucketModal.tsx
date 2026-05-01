import React, { useState } from 'react';
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
import { colors } from '../../constants/colors';
import type { Bucket } from '../../types';

interface AddBucketModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (b: { name: string; type: Bucket['type']; icon: string }) => void;
}

const FIXED_ICONS = [
  '🏠', '💳', '🎓', '📱', '💡', '🏦', '🚗', '🏍️', '🏥', '💊',
  '🛒', '🍔', '📺', '📶', '🎬', '🏋️', '✈️', '🎁', '🧾', '🔧',
];

const GIVE_ICONS = [
  '💸', '👨', '👩', '👨‍👩‍👧', '👶', '👵', '👴', '🤝', '❤️', '🎁',
];

export const AddBucketModal: React.FC<AddBucketModalProps> = ({
  visible,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<Bucket['type']>('fixed');
  const [icon, setIcon] = useState<string>('🏠');

  const onPickType = (t: Bucket['type']) => {
    setType(t);
    setIcon(t === 'give' ? '💸' : '🏠');
  };

  const submit = () => {
    Keyboard.dismiss();
    const n = name.trim();
    if (!n) return;
    onSubmit({ name: n, type, icon });
    setName('');
    setType('fixed');
    setIcon('🏠');
    onClose();
  };

  const iconChoices = type === 'give' ? GIVE_ICONS : FIXED_ICONS;

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
            <Text style={styles.title}>Add new bucket</Text>

            <Text style={styles.label}>Bucket name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Gym"
              autoFocus
            />

            <Text style={styles.label}>Type</Text>
            <View style={styles.typeRow}>
              {(['fixed', 'give'] as const).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => onPickType(t)}
                  style={[
                    styles.typeChip,
                    type === t && styles.typeChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.typeChipText,
                      type === t && styles.typeChipTextActive,
                    ]}
                  >
                    {t === 'fixed' ? 'Fixed payment' : 'Give to someone'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Icon</Text>
            <View style={styles.iconGrid}>
              {iconChoices.map((em) => {
                const active = em === icon;
                return (
                  <Pressable
                    key={em}
                    onPress={() => setIcon(em)}
                    style={[styles.iconCell, active && styles.iconCellActive]}
                  >
                    <Text style={styles.iconEmoji}>{em}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <Pressable onPress={onClose} style={[styles.btn, styles.btnGhost]}>
                <Text style={styles.btnGhostText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={submit} style={[styles.btn, styles.btnPrimary]}>
                <Text style={styles.btnPrimaryText}>Add bucket</Text>
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
  title: { fontSize: 18, fontWeight: '700', color: colors.gray, marginBottom: 16 },
  label: { fontSize: 12, color: colors.gray, opacity: 0.7, marginBottom: 4, marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: colors.grayLight,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: colors.gray,
  },
  typeRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  typeChip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.grayLight,
    alignItems: 'center',
  },
  typeChipActive: { backgroundColor: colors.blue },
  typeChipText: { fontSize: 13, color: colors.gray, fontWeight: '600' },
  typeChipTextActive: { color: colors.white },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  iconCell: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.grayLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  iconCellActive: {
    backgroundColor: colors.blueLight,
    borderColor: colors.blue,
  },
  iconEmoji: { fontSize: 22 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  btnPrimary: { backgroundColor: colors.blue },
  btnPrimaryText: { color: colors.white, fontWeight: '700' },
  btnGhost: { backgroundColor: colors.grayLight },
  btnGhostText: { color: colors.gray, fontWeight: '600' },
});
