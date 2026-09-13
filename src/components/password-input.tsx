import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Spacing, colors, typography } from '@/constants/theme';

// A password field with a show/hide toggle — same visual shell as the plain
// `input` style used elsewhere, just wrapped so an eye icon can sit inside it.
export function PasswordInput({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <View style={styles.wrap}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        secureTextEntry={!isVisible}
        autoCapitalize="none"
      />
      <Pressable onPress={() => setIsVisible((prev) => !prev)} hitSlop={8}>
        <Feather name={isVisible ? 'eye-off' : 'eye'} size={18} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
  },
  input: {
    flex: 1,
    paddingVertical: Spacing.three,
    color: colors.text,
    fontSize: typography.body.fontSize,
  },
});
