import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../constants/colors';

interface ProgressDotsProps {
  current: number;
  total: number;
}

export const ProgressDots: React.FC<ProgressDotsProps> = ({ current, total }) => (
  <View style={styles.wrap}>
    <Text style={styles.label}>
      Step {current} of {total}
    </Text>
    <View style={styles.row}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.segment,
            i < current ? styles.segmentActive : styles.segmentInactive,
          ]}
        />
      ))}
    </View>
  </View>
);

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  label: { fontSize: 12, color: colors.gray, opacity: 0.6, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 6 },
  segment: { flex: 1, height: 4, borderRadius: 2 },
  segmentActive: { backgroundColor: colors.blue },
  segmentInactive: { backgroundColor: colors.grayLight },
});
