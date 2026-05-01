import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { colors } from '../../constants/colors';

interface PurposeChipsProps {
  purposes: string[];
  selected: string | null;
  onSelect: (p: string) => void;
  onAddOther?: () => void;
}

export const PurposeChips: React.FC<PurposeChipsProps> = ({
  purposes,
  selected,
  onSelect,
  onAddOther,
}) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={styles.container}
  >
    {purposes.map((p) => {
      const active = selected === p;
      return (
        <Pressable
          key={p}
          onPress={() => onSelect(p)}
          style={[styles.chip, active && styles.chipActive]}
        >
          <Text style={[styles.chipText, active && styles.chipTextActive]}>
            {p}
          </Text>
        </Pressable>
      );
    })}
    {onAddOther && (
      <Pressable
        onPress={onAddOther}
        style={[styles.chip, styles.chipDashed]}
      >
        <Text style={styles.chipText}>+ Other</Text>
      </Pressable>
    )}
  </ScrollView>
);

const styles = StyleSheet.create({
  container: { gap: 8, paddingVertical: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.grayLight,
  },
  chipActive: { backgroundColor: colors.green },
  chipDashed: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.gray,
  },
  chipText: { fontSize: 13, color: colors.gray, fontWeight: '500' },
  chipTextActive: { color: colors.white, fontWeight: '700' },
});
