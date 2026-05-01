import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors } from '../../constants/colors';
import { formatCurrency } from '../../utils/formatCurrency';

type Status = 'paid' | 'given' | 'pending' | 'partial';

interface BucketRowProps {
  icon: string;
  name: string;
  amount: number;
  subtitle?: string;
  status: Status;
  onPress?: () => void;
  currency?: string;
  hideAmount?: boolean;
}

const STATUS = {
  paid: { label: 'Paid ✓', bg: colors.greenLight, fg: colors.greenDark },
  given: { label: 'Given ✓', bg: colors.blueLight, fg: colors.blueDark },
  pending: { label: 'Mark Paid', bg: colors.redLight, fg: colors.red },
  partial: { label: 'Partial', bg: colors.amberLight, fg: colors.amber },
} as const;

export const BucketRow: React.FC<BucketRowProps> = ({
  icon,
  name,
  amount,
  subtitle,
  status,
  onPress,
  currency = '₹',
  hideAmount = false,
}) => {
  const s = STATUS[status];
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.row,
        status === 'pending' && {
          borderWidth: 1,
          borderColor: colors.red,
        },
        status === 'partial' && {
          borderWidth: 1,
          borderColor: colors.amber,
        },
      ]}
    >
      <Text style={styles.icon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{name}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text
          style={[
            styles.amount,
            status === 'pending' && { color: colors.red },
          ]}
        >
          {hideAmount ? `${currency} xxx` : formatCurrency(amount, currency)}
        </Text>
        <View style={[styles.badge, { backgroundColor: s.bg }]}>
          <Text style={[styles.badgeText, { color: s.fg }]}>{s.label}</Text>
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: colors.white,
    borderRadius: 14,
    marginBottom: 8,
  },
  icon: { fontSize: 26 },
  name: { fontSize: 15, fontWeight: '600', color: colors.gray },
  subtitle: {
    fontSize: 12,
    color: colors.gray,
    opacity: 0.65,
    marginTop: 2,
  },
  amount: { fontSize: 16, fontWeight: '700', color: colors.gray },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 4,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
});
