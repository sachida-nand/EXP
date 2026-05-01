import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';

interface PinPadProps {
  length: number;
  value: string;
  onChange: (v: string) => void;
  onSubmit?: (v: string) => void;
  onBiometric?: () => void;
  showBiometric?: boolean;
  dotColor?: string;
}

const LAYOUT: Array<Array<'num' | 'bio' | 'back' | number>> = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
  ['bio', 0, 'back'],
];

export const PinPad: React.FC<PinPadProps> = ({
  length,
  value,
  onChange,
  onSubmit,
  onBiometric,
  showBiometric = false,
  dotColor = colors.blue,
}) => {
  const press = (v: number) => {
    if (value.length >= length) return;
    const next = value + String(v);
    onChange(next);
    if (next.length === length && onSubmit) onSubmit(next);
  };
  const back = () => onChange(value.slice(0, -1));

  return (
    <View style={styles.container}>
      <View style={styles.dotsRow}>
        {Array.from({ length }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: i < value.length ? dotColor : colors.grayLight,
                borderColor: dotColor,
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.pad}>
        {LAYOUT.map((row, ri) => (
          <View key={ri} style={styles.row}>
            {row.map((cell, ci) => {
              if (cell === 'bio') {
                return (
                  <Pressable
                    key={ci}
                    style={styles.key}
                    onPress={showBiometric ? onBiometric : undefined}
                    disabled={!showBiometric}
                  >
                    {showBiometric && (
                      <Ionicons
                        name="finger-print"
                        size={28}
                        color={colors.gray}
                      />
                    )}
                  </Pressable>
                );
              }
              if (cell === 'back') {
                return (
                  <Pressable key={ci} style={styles.key} onPress={back}>
                    <Ionicons name="backspace-outline" size={26} color={colors.gray} />
                  </Pressable>
                );
              }
              return (
                <Pressable
                  key={ci}
                  style={({ pressed }) => [
                    styles.key,
                    pressed && styles.keyPressed,
                  ]}
                  onPress={() => press(cell as number)}
                >
                  <Text style={styles.keyText}>{cell}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { alignItems: 'center', width: '100%' },
  dotsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 36,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
  },
  pad: { width: '100%', maxWidth: 300, gap: 14 },
  row: {
    flexDirection: 'row',
    gap: 14,
  },
  key: {
    flex: 1,
    aspectRatio: 1.35,
    borderRadius: 18,
    backgroundColor: colors.grayLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyPressed: { opacity: 0.55, transform: [{ scale: 0.97 }] },
  keyText: { fontSize: 26, fontWeight: '500', color: colors.gray },
});
