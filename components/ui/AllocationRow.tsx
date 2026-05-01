import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { colors } from '../../constants/colors';
import { formatCurrency } from '../../utils/formatCurrency';

interface AllocationRowProps {
  icon: string;
  name: string;
  bucketType: string;
  lastMonth: number;
  value: string;
  onChange: (v: string) => void;
  highlight?: boolean;
  currency?: string;
}

const TYPE_LABEL: Record<string, string> = {
  fixed: 'Fixed payment',
  give: 'Transfer',
  wallet: 'YOUR daily wallet',
};

export const AllocationRow: React.FC<AllocationRowProps> = ({
  icon,
  name,
  bucketType,
  lastMonth,
  value,
  onChange,
  highlight,
  currency = '₹',
}) => (
  <View style={[styles.row, highlight && styles.rowHighlight]}>
    <Text style={styles.icon}>{icon}</Text>
    <View style={{ flex: 1 }}>
      <Text style={[styles.name, highlight && { color: colors.blueDark }]}>
        {name}
      </Text>
      <Text style={styles.sub}>
        Last month: {formatCurrency(lastMonth, currency)} · {TYPE_LABEL[bucketType] ?? bucketType}
      </Text>
    </View>
    <View style={styles.inputBox}>
      <Text style={styles.currencySymbol}>{currency}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="numeric"
        placeholder="0"
        style={styles.input}
      />
    </View>
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: colors.white,
    borderRadius: 14,
    marginBottom: 8,
  },
  rowHighlight: {
    backgroundColor: colors.blueLight,
    borderWidth: 1.5,
    borderColor: colors.blue,
  },
  icon: { fontSize: 24 },
  name: { fontSize: 14, fontWeight: '700', color: colors.gray },
  sub: {
    fontSize: 11,
    color: colors.gray,
    opacity: 0.6,
    marginTop: 2,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.grayLight,
    borderRadius: 10,
    paddingHorizontal: 10,
    minWidth: 120,
  },
  currencySymbol: { fontSize: 14, color: colors.gray, marginRight: 2 },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.gray,
    paddingVertical: 8,
    textAlign: 'right',
  },
});
