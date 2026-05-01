import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { colors } from '../../constants/colors';
import type { StoredAccount } from '../../types';

dayjs.extend(relativeTime);

interface UserCardProps {
  account: StoredAccount;
  selected?: boolean;
  onPress?: () => void;
}

const initials = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || '?';
};

export const UserCard: React.FC<UserCardProps> = ({
  account,
  selected,
  onPress,
}) => (
  <Pressable
    onPress={onPress}
    style={[styles.card, selected && styles.cardSelected]}
  >
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{initials(account.name)}</Text>
    </View>
    <Text style={styles.name} numberOfLines={1}>
      {account.name}
    </Text>
    <Text style={styles.lastUsed}>
      Last used {dayjs(account.lastUsedAt).fromNow()}
    </Text>
  </Pressable>
);

interface AddUserCardProps {
  onPress: () => void;
}

export const AddUserCard: React.FC<AddUserCardProps> = ({ onPress }) => (
  <Pressable onPress={onPress} style={[styles.card, styles.cardDashed]}>
    <Text style={styles.plus}>＋</Text>
    <Text style={styles.name}>Add account</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.grayLight,
    minHeight: 140,
    justifyContent: 'center',
  },
  cardSelected: {
    borderColor: colors.blue,
    backgroundColor: colors.blueLight,
  },
  cardDashed: {
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarText: { color: colors.white, fontSize: 20, fontWeight: '700' },
  plus: { fontSize: 40, color: colors.gray, marginBottom: 10 },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.gray,
    marginBottom: 4,
  },
  lastUsed: { fontSize: 12, color: colors.gray, opacity: 0.6 },
});
