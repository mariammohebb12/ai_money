import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';

function getInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function Avatar({
  uri,
  name,
  size = 72,
  onPress,
}: {
  uri?: string | null;
  name: string;
  size?: number;
  onPress?: () => void;
}) {
  const circleStyle = { width: size, height: size, borderRadius: size / 2 };

  const content = uri ? (
    <Image source={{ uri }} style={[styles.image, circleStyle]} contentFit="cover" />
  ) : (
    <View style={[styles.fallback, circleStyle]}>
      <Text style={[styles.initials, { fontSize: size * 0.36 }]}>{getInitials(name)}</Text>
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable onPress={onPress} style={styles.wrapper}>
      {content}
      <View style={styles.editBadge}>
        <Feather name="camera" size={14} color={colors.background} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'center',
  },
  image: {
    backgroundColor: colors.cardBackground,
  },
  fallback: {
    backgroundColor: colors.primaryAccent + '26',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: colors.primaryAccent,
    fontWeight: '700',
  },
  editBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primaryAccent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
});
