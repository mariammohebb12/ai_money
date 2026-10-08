import { StyleSheet, Text, View } from 'react-native';

import { Spacing, colors } from '@/constants/theme';

// A richer treatment for top-level screen titles — an accent bar plus an
// optional subtitle, instead of a single plain line of bold text.
export function ScreenHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.accent} />
      <View>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  accent: {
    width: 4,
    height: 30,
    borderRadius: 2,
    backgroundColor: colors.primaryAccent,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
});
