import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Spacing, colors } from '@/constants/theme';
import { useCurrency } from '@/hooks/use-currency';

// A visually dominant amount field — the currency symbol plus the number are
// the largest, boldest thing on the screen, since the amount is the single
// most important value on every money-entry form.
export function AmountInput({
  value,
  onChangeText,
  autoFocus,
}: {
  value: string;
  onChangeText: (text: string) => void;
  autoFocus?: boolean;
}) {
  const { symbol } = useCurrency();

  return (
    <View style={styles.wrap}>
      <Text style={styles.symbol}>{symbol}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder="0.00"
        placeholderTextColor={colors.text + '40'}
        keyboardType="decimal-pad"
        autoFocus={autoFocus}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  symbol: {
    color: colors.text,
    opacity: 0.45,
    fontSize: 28,
    fontWeight: '700',
    marginRight: Spacing.one,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 32,
    fontWeight: '700',
    padding: 0,
    fontVariant: ['tabular-nums'],
  },
});
