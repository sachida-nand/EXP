import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { isCancelledError } from '../../services/auth/googleAuth';

const BULLETS: Array<{ icon: keyof typeof Ionicons.glyphMap; text: string }> = [
  { icon: 'cloud-outline', text: 'Your data lives in your own Google Drive' },
  { icon: 'phone-portrait-outline', text: 'Works on any phone — just sign in again' },
  { icon: 'lock-closed-outline', text: 'PIN + fingerprint keep it private' },
  { icon: 'people-outline', text: 'Multiple accounts on the same device' },
];

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [busy, setBusy] = useState(false);

  const handleSignIn = async () => {
    setBusy(true);
    try {
      await signIn();
    } catch (err) {
      if (!isCancelledError(err)) {
        const e = err as { code?: string; message?: string };
        console.log('[login] Google Sign-In failed:', {
          code: e?.code,
          message: e?.message,
          raw: err,
        });
        const msg = `${e?.message ?? 'Sign-in failed'}${e?.code ? `\n(code: ${e.code})` : ''}`;
        Alert.alert('Sign-in failed', msg);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.logoWrap}>
          <View style={styles.logoCircle}>
            <Ionicons name="wallet" size={44} color={colors.white} />
          </View>
          <Text style={styles.appName}>Expense Manager</Text>
          <Text style={styles.tagline}>Track your month. Keep your data.</Text>
        </View>

        <View style={styles.bullets}>
          {BULLETS.map((b) => (
            <View key={b.text} style={styles.bulletRow}>
              <Ionicons name={b.icon} size={20} color={colors.blue} />
              <Text style={styles.bulletText}>{b.text}</Text>
            </View>
          ))}
        </View>

        <Pressable
          onPress={handleSignIn}
          disabled={busy}
          style={({ pressed }) => [
            styles.googleBtn,
            pressed && styles.googleBtnPressed,
            busy && styles.googleBtnDisabled,
          ]}
        >
          {busy ? (
            <ActivityIndicator color={colors.gray} />
          ) : (
            <>
              <Ionicons name="logo-google" size={20} color={colors.gray} />
              <Text style={styles.googleBtnText}>Continue with Google</Text>
            </>
          )}
        </Pressable>

        <Text style={styles.footnote}>
          We only access the sheet this app creates in your Drive.
        </Text>
        <Text style={styles.credit}>
          © {new Date().getFullYear()} SACHIDA NAND RAY
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: 'space-between',
  },
  logoWrap: { alignItems: 'center', marginTop: 32 },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  appName: { fontSize: 24, fontWeight: '800', color: colors.gray },
  tagline: {
    fontSize: 14,
    color: colors.gray,
    opacity: 0.6,
    marginTop: 6,
  },
  bullets: { gap: 14, marginVertical: 24 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bulletText: { flex: 1, fontSize: 14, color: colors.gray },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.grayLight,
    paddingVertical: 16,
    borderRadius: 14,
  },
  googleBtnPressed: { opacity: 0.7 },
  googleBtnDisabled: { opacity: 0.6 },
  googleBtnText: { fontSize: 15, fontWeight: '700', color: colors.gray },
  footnote: {
    fontSize: 12,
    color: colors.gray,
    opacity: 0.75,
    textAlign: 'center',
    marginTop: 16,
    fontWeight: '500',
    lineHeight: 18,
  },
  credit: {
    fontSize: 12,
    color: colors.gray,
    opacity: 0.8,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '700',
  },
});
