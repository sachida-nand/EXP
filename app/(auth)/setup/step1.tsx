import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors } from '../../../constants/colors';
import { ProgressDots } from '../../../components/ui/ProgressDots';
import { useSetup } from '../../../context/SetupContext';

const CURRENCIES = [
  { code: '₹', label: 'Indian Rupee (₹)' },
  { code: '$', label: 'US Dollar ($)' },
];

export default function Step1() {
  const setup = useSetup();
  const [dayText, setDayText] = useState(String(setup.salaryDay));

  const next = () => {
    Keyboard.dismiss();
    const trimmed = setup.name.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Please enter your name to continue.');
      return;
    }
    const d = Number(dayText);
    if (!Number.isInteger(d) || d < 1 || d > 31) {
      Alert.alert('Invalid day', 'Salary day must be between 1 and 31.');
      return;
    }
    setup.setName(trimmed);
    setup.setSalaryDay(d);
    router.push('/(auth)/setup/step2');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ProgressDots current={1} total={4} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Tell us about you</Text>
        <Text style={styles.subtitle}>
          This shapes your sheet file and salary reminders.
        </Text>

        <Text style={styles.label}>Your name</Text>
        <TextInput
          value={setup.name}
          onChangeText={setup.setName}
          placeholder="e.g. Sachida Nand"
          style={styles.input}
        />

        <Text style={styles.label}>Salary day of the month</Text>
        <TextInput
          value={dayText}
          onChangeText={setDayText}
          keyboardType="numeric"
          placeholder="1 to 31"
          maxLength={2}
          style={styles.input}
        />

        <Text style={styles.label}>Currency</Text>
        <View style={styles.currencyList}>
          {CURRENCIES.map((c) => {
            const active = setup.currency === c.code;
            return (
              <Pressable
                key={c.code}
                onPress={() => setup.setCurrency(c.code)}
                style={[styles.currencyRow, active && styles.currencyRowActive]}
              >
                <Text
                  style={[
                    styles.currencyText,
                    active && styles.currencyTextActive,
                  ]}
                >
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable onPress={next} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Next</Text>
        </Pressable>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  scroll: { padding: 20, gap: 4 },
  title: { fontSize: 22, fontWeight: '800', color: colors.gray, marginTop: 8 },
  subtitle: {
    fontSize: 13,
    color: colors.gray,
    opacity: 0.6,
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    color: colors.gray,
    opacity: 0.7,
    marginTop: 16,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.grayLight,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: colors.gray,
  },
  currencyList: { gap: 8, marginTop: 4 },
  currencyRow: {
    borderWidth: 1,
    borderColor: colors.grayLight,
    borderRadius: 10,
    padding: 14,
  },
  currencyRowActive: {
    borderColor: colors.blue,
    backgroundColor: colors.blueLight,
  },
  currencyText: { fontSize: 14, color: colors.gray },
  currencyTextActive: { color: colors.blueDark, fontWeight: '700' },
  footer: { padding: 20 },
  primaryBtn: {
    backgroundColor: colors.blue,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
