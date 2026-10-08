import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ModalCloseButton } from '@/components/modal-close-button';
import { Spacing, colors, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useCurrency } from '@/hooks/use-currency';
import { useSaveSuccess } from '@/hooks/use-save-success';
import { supabase } from '@/lib/supabase';

type Category = {
  id: string;
  name: string;
  color: string;
  icon: string;
};

// Adds an alpha suffix to a "#RRGGBB" hex color, e.g. withAlpha('#C1613B', '33') -> '#C1613B33'.
function withAlpha(hex: string, alpha: string) {
  return `${hex}${alpha}`;
}

export default function EditBudgetsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { symbol } = useCurrency();

  const [categories, setCategories] = useState<Category[]>([]);
  const [limits, setLimits] = useState<Record<string, string>>({});
  const [initialLimits, setInitialLimits] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { justSaved, triggerSuccess } = useSaveSuccess(() => router.back());

  const fetchData = useCallback(async () => {
    if (!session) return;
    const [categoriesResult, budgetsResult] = await Promise.all([
      supabase.from('categories').select('id, name, color, icon').neq('name', 'Income').order('name'),
      supabase.from('budgets').select('category_id, monthly_limit').eq('user_id', session.user.id),
    ]);

    if (categoriesResult.error) {
      console.error('Failed to fetch categories:', categoriesResult.error.message);
      setIsLoading(false);
      return;
    }
    if (budgetsResult.error) {
      console.error('Failed to fetch budgets:', budgetsResult.error.message);
      setIsLoading(false);
      return;
    }

    setCategories(categoriesResult.data);
    const loaded: Record<string, string> = {};
    for (const budget of budgetsResult.data) {
      loaded[budget.category_id] = String(budget.monthly_limit);
    }
    setLimits(loaded);
    setInitialLimits(loaded);
    setIsLoading(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      fetchData();
    }, [fetchData])
  );

  async function handleSave() {
    setErrorMessage('');
    if (!session) {
      setErrorMessage('You need to be logged in to save budgets.');
      return;
    }

    const upserts: { user_id: string; category_id: string; monthly_limit: number }[] = [];
    const deletions: string[] = [];

    for (const category of categories) {
      const raw = (limits[category.id] ?? '').trim();
      const had = category.id in initialLimits;

      if (!raw) {
        if (had) deletions.push(category.id);
        continue;
      }

      const parsed = parseFloat(raw);
      if (Number.isNaN(parsed) || parsed <= 0) {
        setErrorMessage(`Enter a valid limit for ${category.name}, or leave it blank.`);
        return;
      }

      if (raw !== initialLimits[category.id]) {
        upserts.push({ user_id: session.user.id, category_id: category.id, monthly_limit: parsed });
      }
    }

    if (upserts.length === 0 && deletions.length === 0) {
      triggerSuccess();
      return;
    }

    setIsSaving(true);
    const [upsertResult, deleteResult] = await Promise.all([
      upserts.length > 0
        ? supabase.from('budgets').upsert(upserts, { onConflict: 'user_id,category_id' })
        : Promise.resolve({ error: null }),
      deletions.length > 0
        ? supabase.from('budgets').delete().eq('user_id', session.user.id).in('category_id', deletions)
        : Promise.resolve({ error: null }),
    ]);
    setIsSaving(false);

    if (upsertResult.error || deleteResult.error) {
      setErrorMessage(`Save failed: ${(upsertResult.error ?? deleteResult.error)!.message}`);
      return;
    }

    triggerSuccess();
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <ModalCloseButton />
        <Text style={styles.title}>Monthly budgets</Text>
      </View>
      <Text style={styles.subtitle}>
        Set a monthly spending limit per category. Leave a field blank for no limit.
      </Text>

      {isLoading ? (
        <ActivityIndicator style={styles.loading} color={colors.primaryAccent} />
      ) : (
        <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          {categories.map((category) => (
            <View key={category.id} style={styles.row}>
              <View style={[styles.iconBadge, { backgroundColor: withAlpha(category.color, '33') }]}>
                <Ionicons name={category.icon as any} size={18} color={category.color} />
              </View>
              <Text style={styles.categoryName}>{category.name}</Text>
              <View style={styles.inputWrap}>
                <Text style={styles.inputSymbol}>{symbol}</Text>
                <TextInput
                  style={styles.input}
                  value={limits[category.id] ?? ''}
                  onChangeText={(text) => setLimits((prev) => ({ ...prev, [category.id]: text }))}
                  placeholder="No limit"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          ))}

          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

          <Pressable
            style={[styles.saveButton, justSaved && styles.saveButtonSuccess]}
            onPress={handleSave}
            disabled={isSaving || justSaved}>
            <Text style={styles.saveButtonText}>
              {justSaved ? 'Saved' : isSaving ? 'Saving…' : 'Save budgets'}
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  title: {
    color: colors.text,
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
    marginTop: Spacing.two,
  },
  loading: {
    marginTop: Spacing.six,
  },
  list: {
    marginTop: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: colors.cardBackground,
    borderRadius: 18,
    padding: Spacing.three,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryName: {
    flex: 1,
    color: colors.text,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  inputSymbol: {
    color: colors.textMuted,
    fontSize: typography.body.fontSize,
    marginRight: 2,
  },
  input: {
    width: 72,
    color: colors.text,
    fontSize: typography.body.fontSize,
    fontWeight: '700',
    padding: 0,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  error: {
    color: colors.secondaryAccent,
    marginTop: Spacing.two,
  },
  saveButton: {
    backgroundColor: colors.primaryAccent,
    borderRadius: 20,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.four,
  },
  saveButtonSuccess: {
    backgroundColor: colors.chartSage,
  },
  saveButtonText: {
    color: colors.background,
    fontWeight: '700',
    fontSize: typography.body.fontSize,
  },
});
