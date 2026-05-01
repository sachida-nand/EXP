import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors } from '../../constants/colors';
import { PinPad } from '../../components/ui/PinPad';
import { useAuth } from '../../hooks/useAuth';
import { useBiometric } from '../../hooks/useBiometric';
import { verifyPin } from '../../services/auth/pinAuth';

type Mode = 'bio' | 'pin';

export default function PinScreen() {
  const { user, accounts, unlock, signOut } = useAuth();
  const { usable, enabled, authenticate } = useBiometric();
  const [mode, setMode] = useState<Mode>('pin');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (usable && enabled) setMode('bio');
    else setMode('pin');
  }, [usable, enabled]);

  const onUnlock = useCallback(() => {
    if (accounts.length > 1) {
      router.replace('/(auth)/switcher');
    } else {
      unlock();
    }
  }, [accounts.length, unlock]);

  const tryBio = useCallback(async () => {
    const ok = await authenticate('Unlock Expense Manager');
    if (ok) onUnlock();
    else setMode('pin');
  }, [authenticate, onUnlock]);

  useEffect(() => {
    if (mode === 'bio') void tryBio();
  }, [mode, tryBio]);

  const onSubmit = async (pin: string) => {
    if (!user) return;
    const ok = await verifyPin(user.uid, pin);
    if (ok) {
      setError(null);
      onUnlock();
    } else {
      setError('Wrong PIN. Try again.');
      setValue('');
    }
  };

  const forgotPin = () => {
    Alert.alert(
      'Reset PIN?',
      'You will be signed out. Sign in with Google again to set a new PIN. Your data stays in your sheet.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
      ],
    );
  };

  if (mode === 'bio') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.hello}>Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}</Text>
          <Pressable style={styles.bigBio} onPress={tryBio}>
            <Ionicons name="finger-print" size={96} color={colors.blue} />
            <Text style={styles.bioHint}>Touch to unlock</Text>
          </Pressable>
          <Pressable onPress={() => setMode('pin')} style={styles.textBtn}>
            <Text style={styles.textBtnLabel}>Use PIN instead</Text>
          </Pressable>
          <Pressable onPress={forgotPin} style={styles.textBtn}>
            <Text style={styles.textBtnMuted}>Forgot PIN? Use Google to reset</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.hello}>
          Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
        </Text>
        <Text style={styles.subtitle}>Enter your 4-digit PIN</Text>

        <View style={styles.padWrap}>
          <PinPad
            length={4}
            value={value}
            onChange={(v) => {
              setError(null);
              setValue(v);
            }}
            onSubmit={onSubmit}
            showBiometric={usable && enabled}
            onBiometric={() => setMode('bio')}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable onPress={forgotPin} style={styles.textBtn}>
          <Text style={styles.textBtnMuted}>Forgot PIN? Use Google to reset</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
  },
  hello: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.gray,
    marginTop: 16,
  },
  subtitle: {
    fontSize: 14,
    color: colors.gray,
    opacity: 0.6,
    marginTop: 6,
    marginBottom: 32,
  },
  padWrap: { marginTop: 24, width: '100%', alignItems: 'center' },
  error: {
    marginTop: 12,
    color: colors.red,
    fontSize: 13,
    fontWeight: '600',
  },
  bigBio: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  bioHint: {
    marginTop: 16,
    fontSize: 14,
    color: colors.gray,
    opacity: 0.6,
  },
  textBtn: { paddingVertical: 14 },
  textBtnLabel: { fontSize: 14, fontWeight: '600', color: colors.blue },
  textBtnMuted: { fontSize: 13, color: colors.gray, opacity: 0.6 },
});
