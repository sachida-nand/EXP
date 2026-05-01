import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { useBiometric } from '../../hooks/useBiometric';
import { secureStorage } from '../../services/storage/secureStorage';

export default function SettingsScreen() {
  const { user, sheetId, accounts, signOut, lock, switchUser, refreshAccounts } = useAuth();
  const { usable, enabled, setEnabled } = useBiometric();

  const [salaryDay, setSalaryDay] = useState<number | null>(null);
  const [currency, setCurrency] = useState('₹');

  useEffect(() => {
    if (!user) return;
    void secureStorage.getSalaryDay(user.uid).then(setSalaryDay);
    void secureStorage.getCurrency(user.uid).then((c) => c && setCurrency(c));
  }, [user]);

  const removeAccount = (uid: string, name: string) => {
    Alert.alert(
      'Remove from device?',
      `${name} will be removed locally. Your data stays in their Google Drive.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await secureStorage.removeAccount(uid);
            await refreshAccounts();
            if (uid === user?.uid) await signOut();
          },
        },
      ],
    );
  };

  const initials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Settings</Text>

        {user ? (
          <View style={styles.profile}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(user.name)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>{user.name}</Text>
              <Text style={styles.profileEmail}>{user.email}</Text>
            </View>
          </View>
        ) : null}

        <Text style={styles.section}>Google Sheets</Text>
        <View style={styles.row}>
          <Ionicons name="document-outline" size={18} color={colors.gray} />
          <Text style={styles.rowLabel} numberOfLines={1}>
            {sheetId
              ? `Connected: Expense Manager — ${user?.name ?? ''}`
              : 'Not connected'}
          </Text>
        </View>

        <Text style={styles.section}>Preferences</Text>
        <View style={styles.row}>
          <Ionicons name="calendar-outline" size={18} color={colors.gray} />
          <Text style={styles.rowLabel}>Salary day</Text>
          <Text style={styles.rowValue}>{salaryDay ?? '—'}</Text>
        </View>
        <View style={styles.row}>
          <Ionicons name="cash-outline" size={18} color={colors.gray} />
          <Text style={styles.rowLabel}>Currency</Text>
          <Text style={styles.rowValue}>{currency}</Text>
        </View>
        {usable ? (
          <View style={styles.row}>
            <Ionicons name="finger-print" size={18} color={colors.gray} />
            <Text style={[styles.rowLabel, { flex: 1 }]}>Fingerprint lock</Text>
            <Switch value={enabled} onValueChange={(v) => void setEnabled(v)} />
          </View>
        ) : null}

        <Text style={styles.section}>Accounts</Text>
        {accounts.map((a) => (
          <View key={a.uid} style={styles.accountRow}>
            <View style={styles.avatarSm}>
              <Text style={styles.avatarSmText}>{initials(a.name)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>
                {a.name}{' '}
                {a.uid === user?.uid ? (
                  <Text style={styles.activeTag}>· active</Text>
                ) : null}
              </Text>
              <Text style={styles.profileEmail}>{a.email}</Text>
            </View>
            {a.uid !== user?.uid ? (
              <Pressable
                onPress={() => void switchUser(a.uid)}
                style={styles.switchBtn}
              >
                <Text style={styles.switchBtnText}>Switch</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => removeAccount(a.uid, a.name)}
              style={styles.removeBtn}
            >
              <Text style={styles.removeBtnText}>Remove</Text>
            </Pressable>
          </View>
        ))}

        <View style={{ height: 16 }} />

        <Pressable onPress={lock} style={[styles.btn, styles.ghostBtn]}>
          <Text style={styles.ghostBtnText}>Lock now</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            Alert.alert('Sign out?', 'You will need to sign in again.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
            ]);
          }}
          style={[styles.btn, styles.dangerBtn]}
        >
          <Text style={styles.dangerBtnText}>Sign out</Text>
        </Pressable>

        <View style={styles.footer}>
          <Text style={styles.footerApp}>Expense Manager</Text>
          <Text style={styles.footerCredit}>
            © {new Date().getFullYear()} SACHIDA NAND RAY
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  scroll: { padding: 16 },
  title: { fontSize: 22, fontWeight: '800', color: colors.gray, marginBottom: 12 },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.grayLight,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.white, fontWeight: '700', fontSize: 18 },
  avatarSm: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSmText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  profileName: { fontSize: 15, fontWeight: '700', color: colors.gray },
  profileEmail: { fontSize: 12, color: colors.gray, opacity: 0.6, marginTop: 2 },
  section: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.gray,
    opacity: 0.7,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.grayLight,
  },
  rowLabel: { fontSize: 14, color: colors.gray, flex: 1 },
  rowValue: { fontSize: 14, color: colors.gray, fontWeight: '600' },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  activeTag: { color: colors.green, fontSize: 12, fontWeight: '600' },
  switchBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: colors.blueLight,
  },
  switchBtnText: { color: colors.blueDark, fontSize: 12, fontWeight: '700' },
  removeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: colors.redLight,
  },
  removeBtnText: { color: colors.red, fontSize: 12, fontWeight: '700' },
  btn: {
    marginTop: 10,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  ghostBtn: { backgroundColor: colors.grayLight },
  ghostBtnText: { color: colors.gray, fontWeight: '700' },
  dangerBtn: { backgroundColor: colors.redLight },
  dangerBtnText: { color: colors.red, fontWeight: '700' },
  footer: {
    marginTop: 28,
    alignItems: 'center',
    gap: 4,
  },
  footerApp: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.gray,
    opacity: 0.9,
  },
  footerCredit: {
    fontSize: 12,
    color: colors.gray,
    opacity: 0.8,
    fontWeight: '600',
  },
});
