import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing, colors, typography } from '@/constants/theme';

// A tap-to-open field that opens a bottom-sheet list of options — used for
// any "pick one of a few labeled values" input (bill frequency, currency, …).
export function OptionPickerField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedLabel = options.find((option) => option.value === value)?.label ?? '';

  return (
    <>
      <Pressable style={styles.field} onPress={() => setIsOpen(true)}>
        <Text style={styles.fieldValue}>{selectedLabel}</Text>
        <Feather name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setIsOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{label}</Text>
            {options.map((option, index) => {
              const isSelected = option.value === value;
              return (
                <Pressable
                  key={option.value}
                  style={[styles.option, index < options.length - 1 && styles.optionDivider]}
                  onPress={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}>
                  <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{option.label}</Text>
                  {isSelected && <Feather name="check" size={18} color={colors.primaryAccent} />}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: Spacing.three,
  },
  fieldValue: {
    color: colors.text,
    fontSize: typography.body.fontSize,
  },
  overlay: {
    flex: 1,
    backgroundColor: '#00000055',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.cardBackground,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.four,
    paddingBottom: Spacing.five,
  },
  sheetTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: Spacing.two,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
  },
  optionDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.background,
  },
  optionText: {
    color: colors.text,
    fontSize: typography.body.fontSize,
  },
  optionTextSelected: {
    color: colors.primaryAccent,
    fontWeight: '700',
  },
});
