import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { colors } from '@/constants/theme';

// Dismisses the current modal/screen without saving. Placed top-left and
// styled the same everywhere so every add/edit screen closes consistently.
export function ModalCloseButton() {
  const router = useRouter();

  function handleClose() {
    // If this screen was reached with nothing behind it in the stack (a dev
    // reload while sitting on it, a deep link), router.back() has nowhere to
    // go and fails silently with a "GO_BACK not handled" warning — fall back
    // to sending the user home instead of leaving the close button dead.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }

  return (
    <Pressable style={styles.button} onPress={handleClose} hitSlop={8}>
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
