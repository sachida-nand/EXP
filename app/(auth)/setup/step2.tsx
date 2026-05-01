import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors } from '../../../constants/colors';
import { ProgressDots } from '../../../components/ui/ProgressDots';
import { AddBucketModal } from '../../../components/modals/AddBucketModal';
import { useSetup } from '../../../context/SetupContext';
import { defaultBuckets, optionalBuckets } from '../../../constants/defaultBuckets';
import type { Bucket } from '../../../types';

const TYPE_LABEL: Record<Bucket['type'], string> = {
  fixed: 'Fixed payment',
  give: 'Transfer',
  wallet: 'Daily wallet',
};

export default function Step2() {
  const setup = useSetup();
  const [showAdd, setShowAdd] = useState(false);

  const allOptions: Bucket[] = [
    ...defaultBuckets,
    ...optionalBuckets,
    ...setup.buckets.filter(
      (b) =>
        !defaultBuckets.some((d) => d.id === b.id) &&
        !optionalBuckets.some((o) => o.id === b.id),
    ),
  ];

  const isSelected = (b: Bucket) => setup.buckets.some((x) => x.id === b.id);

  const handleAddCustom = ({
    name,
    type,
    icon,
  }: {
    name: string;
    type: Bucket['type'];
    icon: string;
  }) => {
    const newBucket: Bucket = {
      id: `custom-${Date.now()}`,
      name,
      icon,
      color: colors.blue,
      bgColor: colors.blueLight,
      type,
      isWallet: false,
    };
    setup.setBuckets([...setup.buckets, newBucket]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ProgressDots current={2} total={4} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Choose your buckets</Text>
        <Text style={styles.subtitle}>
          Tap to include/exclude. You can tweak amounts later.
        </Text>

        <View style={styles.walletCard}>
          <Text style={styles.walletIcon}>📋</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.walletName}>My Monthly Expense</Text>
            <Text style={styles.walletSub}>
              Your daily wallet — always included
            </Text>
          </View>
          <Text style={styles.walletBadge}>Required</Text>
        </View>

        <View style={styles.grid}>
          {allOptions
            .filter((b) => !b.isWallet)
            .map((b) => {
              const active = isSelected(b);
              return (
                <Pressable
                  key={b.id}
                  onPress={() => setup.toggleBucket(b)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={styles.chipIcon}>{b.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.chipName,
                        active && styles.chipNameActive,
                      ]}
                    >
                      {b.name}
                    </Text>
                    <Text style={styles.chipType}>{TYPE_LABEL[b.type]}</Text>
                  </View>
                  <View
                    style={[styles.check, active && styles.checkActive]}
                  >
                    {active ? <Text style={styles.checkMark}>✓</Text> : null}
                  </View>
                </Pressable>
              );
            })}
        </View>

        <Pressable onPress={() => setShowAdd(true)} style={styles.addBtn}>
          <Text style={styles.addBtnText}>+ Add custom bucket</Text>
        </Pressable>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable onPress={() => router.back()} style={[styles.btn, styles.ghostBtn]}>
          <Text style={styles.ghostBtnText}>Back</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/(auth)/setup/step3')}
          style={[styles.btn, styles.primaryBtn]}
        >
          <Text style={styles.primaryBtnText}>Next</Text>
        </Pressable>
      </View>

      <AddBucketModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onSubmit={handleAddCustom}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  scroll: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '800', color: colors.gray },
  subtitle: {
    fontSize: 13,
    color: colors.gray,
    opacity: 0.6,
    marginTop: 4,
    marginBottom: 16,
  },
  walletCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.greenLight,
    borderWidth: 1.5,
    borderColor: colors.green,
    marginBottom: 12,
  },
  walletIcon: { fontSize: 24 },
  walletName: { fontSize: 14, fontWeight: '700', color: colors.greenDark },
  walletSub: { fontSize: 11, color: colors.greenDark, opacity: 0.7, marginTop: 2 },
  walletBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.greenDark,
    textTransform: 'uppercase',
  },
  grid: { gap: 8, marginTop: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.grayLight,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  chipActive: {
    backgroundColor: colors.blueLight,
    borderColor: colors.blue,
  },
  chipIcon: { fontSize: 22 },
  chipName: { fontSize: 14, fontWeight: '700', color: colors.gray },
  chipNameActive: { color: colors.blueDark },
  chipType: { fontSize: 11, color: colors.gray, opacity: 0.6, marginTop: 2 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.gray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  checkMark: { color: colors.white, fontSize: 14, fontWeight: '700' },
  addBtn: {
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.gray,
    alignItems: 'center',
  },
  addBtnText: { color: colors.gray, fontWeight: '600' },
  footer: { flexDirection: 'row', gap: 10, padding: 20 },
  btn: { flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  primaryBtn: { backgroundColor: colors.blue },
  primaryBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  ghostBtn: { backgroundColor: colors.grayLight },
  ghostBtnText: { color: colors.gray, fontWeight: '600', fontSize: 15 },
});
