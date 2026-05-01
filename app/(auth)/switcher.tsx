import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors } from '../../constants/colors';
import { UserCard, AddUserCard } from '../../components/ui/UserCard';
import { useAuth } from '../../hooks/useAuth';
import { isCancelledError } from '../../services/auth/googleAuth';

export default function SwitcherScreen() {
  const { accounts, user, switchUser, signIn, unlock } = useAuth();
  const [selectedUid, setSelectedUid] = useState<string | null>(user?.uid ?? null);
  const [busy, setBusy] = useState(false);

  const selected = accounts.find((a) => a.uid === selectedUid);

  const addAccount = async () => {
    setBusy(true);
    try {
      await signIn();
    } catch (err) {
      if (!isCancelledError(err)) {
        const e = err as { code?: string; message?: string };
        console.log('[switcher] Google Sign-In failed:', {
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

  const enterAs = async () => {
    if (!selected) return;
    if (selected.uid === user?.uid) {
      unlock();
      return;
    }
    setBusy(true);
    try {
      await switchUser(selected.uid);
      router.replace('/(auth)/pin');
    } finally {
      setBusy(false);
    }
  };

  const rows: Array<typeof accounts[number] | 'add'> = [...accounts, 'add'];
  const grid: Array<Array<typeof rows[number]>> = [];
  for (let i = 0; i < rows.length; i += 2) grid.push(rows.slice(i, i + 2));

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Who's using?</Text>
        <Text style={styles.subtitle}>Pick an account to continue.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {grid.map((row, ri) => (
          <View key={ri} style={styles.row}>
            {row.map((item, ci) =>
              item === 'add' ? (
                <AddUserCard key="add" onPress={addAccount} />
              ) : (
                <UserCard
                  key={item.uid}
                  account={item}
                  selected={selectedUid === item.uid}
                  onPress={() => setSelectedUid(item.uid)}
                />
              ),
            )}
            {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={enterAs}
          disabled={!selected || busy}
          style={[
            styles.primaryBtn,
            (!selected || busy) && styles.primaryBtnDisabled,
          ]}
        >
          <Text style={styles.primaryBtnText}>
            {selected ? `Enter as ${selected.name.split(' ')[0]}` : 'Select an account'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  header: { paddingHorizontal: 20, paddingTop: 24 },
  title: { fontSize: 24, fontWeight: '800', color: colors.gray },
  subtitle: {
    fontSize: 14,
    color: colors.gray,
    opacity: 0.6,
    marginTop: 6,
  },
  scroll: { padding: 16, gap: 12 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  footer: { padding: 20 },
  primaryBtn: {
    backgroundColor: colors.blue,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
