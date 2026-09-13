import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Spacing, colors, typography } from '@/constants/theme';
import { toDateString } from '@/lib/dates';
import { supabase } from '@/lib/supabase';

type Status = 'loading' | 'ready' | 'not-enough-data' | 'hidden';

export function AiInsightCard({
  cacheKey,
  focusLabel,
  hasEnoughData,
}: {
  // Identifies this insight slot for daily caching, e.g. "home" or "analytics-7d".
  cacheKey: string;
  // Tells the AI what period to focus on, e.g. "the last 7 days".
  focusLabel: string;
  hasEnoughData: boolean;
}) {
  const [insight, setInsight] = useState('');
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');

    async function loadInsight() {
      const storageKey = `ai-insight:${cacheKey}:${toDateString(new Date())}`;

      try {
        const cached = await AsyncStorage.getItem(storageKey);
        if (cached) {
          if (!cancelled) {
            setInsight(cached);
            setStatus('ready');
          }
          return;
        }
      } catch {
        // Couldn't read the cache — fall through and generate a fresh insight.
      }

      if (!hasEnoughData) {
        if (!cancelled) setStatus('not-enough-data');
        return;
      }

      const { data, error } = await supabase.functions.invoke('ai-coach', {
        body: { mode: 'insight', focus: focusLabel },
      });

      if (cancelled) return;

      if (error || !data?.reply) {
        setStatus('hidden');
        return;
      }

      setInsight(data.reply);
      setStatus('ready');
      AsyncStorage.setItem(storageKey, data.reply).catch(() => {});
    }

    loadInsight();
    return () => {
      cancelled = true;
    };
  }, [cacheKey, focusLabel, hasEnoughData]);

  if (status === 'loading' || status === 'hidden') return null;

  return (
    <View style={styles.card}>
      <View style={styles.badge}>
        <Text style={styles.badgeIcon}>✨</Text>
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.label}>AI Insight</Text>
        <Text style={styles.insightText}>
          {status === 'not-enough-data' ? 'Not enough activity yet for an insight.' : insight}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    backgroundColor: colors.chartDustyBlue + '14',
    borderWidth: 1,
    borderColor: colors.chartDustyBlue + '33',
    borderRadius: 20,
    padding: Spacing.three,
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.chartDustyBlue + '26',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeIcon: {
    fontSize: 15,
  },
  textWrap: {
    flex: 1,
  },
  label: {
    color: colors.chartDustyBlue,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  insightText: {
    color: colors.text,
    fontSize: typography.body.fontSize,
    marginTop: 2,
  },
});
