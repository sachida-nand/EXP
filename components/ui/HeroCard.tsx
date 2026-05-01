import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../constants/colors';

interface HeroCardProps {
  backgroundColor?: string;
  children?: React.ReactNode;
  style?: ViewStyle;
}

export const HeroCard: React.FC<HeroCardProps> = ({
  backgroundColor = colors.blue,
  children,
  style,
}) => (
  <View style={[styles.card, { backgroundColor }, style]}>{children}</View>
);

interface ProgressBarProps {
  value: number;
  max: number;
  color?: string;
  bgColor?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max,
  color = colors.white,
  bgColor = 'rgba(255,255,255,0.25)',
}) => {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <View style={[styles.barBg, { backgroundColor: bgColor }]}>
      <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  barBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 8,
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
});
