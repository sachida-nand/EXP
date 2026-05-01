import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors } from '../../../constants/colors';
import { ProgressDots } from '../../../components/ui/ProgressDots';
import { PinPad } from '../../../components/ui/PinPad';
import { useSetup } from '../../../context/SetupContext';
import { useBiometric } from '../../../hooks/useBiometric';
import { isValidPinShape } from '../../../services/auth/pinAuth';

type Phase = 'create' | 'confirm';

export default function Step3() {
  const setup = useSetup();
  const { usable } = useBiometric();
  const [phase, setPhase] = useState<Phase>('create');
  const [firstPin, setFirstPin] = useState('');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (pin: string) => {
    if (!isValidPinShape(pin)) {
      setError('PIN must be 4 digits');
      setValue('');
      return;
    }
    if (phase === 'create') {
      setFirstPin(pin);
      setValue('');
      setError(null);
      setPhase('confirm');
    } else {
      if (pin !== firstPin) {
        setError('PINs did not match. Try again.');
        setFirstPin('');
        setValue('');
        setPhase('create');
        return;
      }
      setup.setPin(pin);
      setError(null);
      router.push('/(auth)/setup/step4');
    }
  };

  const heading = phase === 'create' ? 'Set a 4-digit PIN' : 'Confirm your PIN';
  const subheading =
    phase === 'create'
      ? 'Used to unlock the app. Stored only on this device.'
      : 'Enter the same PIN again to confirm.';

  return (
    <SafeAreaView style={styles.safe}>
      <ProgressDots current={3} total={4} />
      <View style={styles.container}>
        <Text style={styles.title}>{heading}</Text>
        <Text style={styles.subtitle}>{subheading}</Text>

        <View style={styles.padWrap}>
          <PinPad
            length={4}
            value={value}
            onChange={(v) => {
              setError(null);
              setValue(v);
            }}
            onSubmit={onSubmit}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {phase === 'create' && usable ? (
          <View style={styles.bioRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bioTitle}>Enable fingerprint</Text>
              <Text style={styles.bioSub}>
                Unlock faster with your fingerprint.
              </Text>
            </View>
            <Switch
              value={setup.biometricEnabled}
              onValueChange={setup.setBiometricEnabled}
            />
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        <Pressable
          onPress={() => {
            if (phase === 'confirm') {
              setPhase('create');
              setFirstPin('');
              setValue('');
              setError(null);
            } else {
              router.back();
            }
          }}
          style={[styles.btn, styles.ghostBtn]}
        >
          <Text style={styles.ghostBtnText}>Back</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  container: { flex: 1, padding: 20, alignItems: 'center' },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.gray,
    marginTop: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: colors.gray,
    opacity: 0.6,
    marginTop: 6,
    marginBottom: 24,
    textAlign: 'center',
  },
  padWrap: { marginTop: 20, width: '100%', alignItems: 'center' },
  error: { marginTop: 12, color: colors.red, fontSize: 13, fontWeight: '600' },
  bioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.grayLight,
    marginTop: 24,
    width: '100%',
  },
  bioTitle: { fontSize: 14, fontWeight: '700', color: colors.gray },
  bioSub: { fontSize: 12, color: colors.gray, opacity: 0.6, marginTop: 2 },
  footer: { padding: 20 },
  btn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  ghostBtn: { backgroundColor: colors.grayLight },
  ghostBtnText: { color: colors.gray, fontWeight: '600' },
});
