import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Spacing, colors } from '@/constants/theme';

// Small in-app wordmark for the auth screens — the first thing a new user
// sees, so it shouldn't be bare text with no identity above it.
export function BrandMark() {
  return (
    <View style={styles.wrap}>
      <View style={styles.badge}>
        <Feather name="trending-up" size={22} color={colors.background} />
      </View>
      <Text style={styles.wordmark}>AI Money</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    marginBottom: Spacing.five,
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryAccent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  wordmark: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
});
