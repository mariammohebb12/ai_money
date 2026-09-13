import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { colors } from '@/constants/theme';

// Dismisses the current modal/screen without saving. Placed top-left and
// styled the same everywhere so every add/edit screen closes consistently.
export function ModalCloseButton() {
  const router = useRouter();

  return (
    <Pressable style={styles.button} onPress={() => router.back()} hitSlop={8}>
      <Feather name="x" size={18} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.text + '0F',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
