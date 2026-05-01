import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../constants/colors';

interface StatCardProps {
  label: string;
  value: string;
  color?: string;
  bgColor?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  color = colors.gray,
  bgColor = colors.white,
}) => (
  <View style={[styles.card, { backgroundColor: bgColor }]}>
    <Text style={styles.label}>{label}</Text>
    <Text style={[styles.value, { color }]} numberOfLines={1} adjustsFontSizeToFit>
      {value}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    minHeight: 80,
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    color: colors.gray,
    opacity: 0.7,
    marginBottom: 4,
  },
  value: { fontSize: 20, fontWeight: '700' },
});
