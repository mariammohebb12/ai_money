import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing, colors, typography } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

// TEMPORARY until real login exists. To get a real id:
// Supabase Dashboard → Authentication → Users → copy a user's UUID
// (or click "Add user" to create a throwaway test account and copy its id).
const TEMP_USER_ID = 'ae6f8eb5-6b79-489d-b057-1509c6ea276a';

type Category = {
  id: string | number;
  name: string;
  color: string;
  icon: string;
};

// Adds an alpha suffix to a "#RRGGBB" hex color, e.g. withAlpha('#C1613B', '33') -> '#C1613B33'.
function withAlpha(hex: string, alpha: string) {
  return `${hex}${alpha}`;
}

export default function AddTransactionScreen() {
  const router = useRouter();

  const [amount, setAmount] = useState('');
  const [isIncome, setIsIncome] = useState(false);
  const [merchant, setMerchant] = useState('');
  const [note, setNote] = useState('');

  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | number | null>(null);
  const [incomeCategoryId, setIncomeCategoryId] = useState<string | number | null>(null);

  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const selectedCategory = expenseCategories.find((c) => c.id === selectedCategoryId);
  const isOtherSelected = selectedCategory?.name === 'Other';

  useEffect(() => {
    async function fetchExpenseCategories() {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, color, icon')
        .neq('name', 'Income');
      if (error) {
        console.error('Failed to fetch categories:', error.message);
        return;
      }
      setExpenseCategories(data);
    }

    async function fetchIncomeCategory() {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name')
        .eq('name', 'Income')
        .single();
      if (error) {
        console.error('Failed to fetch income category:', error.message);
        return;
      }
      setIncomeCategoryId(data.id);
    }

    fetchExpenseCategories();
    fetchIncomeCategory();
  }, []);

  async function handleSave() {
    setErrorMessage('');

    const parsedAmount = parseFloat(amount);
    if (!amount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage('Please enter a valid amount.');
      return;
    }

    const categoryId = isIncome ? incomeCategoryId : selectedCategoryId;
    if (!categoryId) {
      setErrorMessage(isIncome ? 'Income category not found.' : 'Please choose a category.');
      return;
    }

    setIsSaving(true);
    const { error } = await supabase.from('transactions').insert({
      user_id: TEMP_USER_ID,
      amount: parsedAmount,
      type: isIncome ? 'income' : 'expense',
      category_id: categoryId,
      merchant,
      note: note || null,
    });
    setIsSaving(false);

    if (error) {
      setErrorMessage(`Save failed: ${error.message}`);
      return;
    }

    router.back();
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Add transaction</Text>

        <Text style={styles.label}>Amount</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          placeholderTextColor={colors.text + '80'}
          keyboardType="decimal-pad"
        />

        <View style={styles.toggleRow}>
          <Text style={styles.label}>{isIncome ? 'Income' : 'Expense'}</Text>
          <Switch
            value={isIncome}
            onValueChange={setIsIncome}
            trackColor={{ false: colors.secondaryAccent, true: colors.chartSage }}
          />
        </View>

        {!isIncome && (
          <>
            <Text style={styles.label}>Category</Text>
            <View style={styles.categoryRow}>
              {expenseCategories.map((category) => {
                const isSelected = category.id === selectedCategoryId;
                return (
                  <Pressable
                    key={category.id}
                    onPress={() => setSelectedCategoryId(category.id)}
                    style={[
                      styles.categoryChip,
                      isSelected && {
                        backgroundColor: withAlpha(category.color, '26'),
                        borderColor: category.color,
                      },
                    ]}>
                    <View
                      style={[
                        styles.categoryIconBadge,
                        isSelected && { backgroundColor: withAlpha(category.color, '33') },
                      ]}>
                      <Ionicons name={category.icon as any} size={16} color={category.color} />
                    </View>
                    <Text
                      style={[
                        styles.categoryChipText,
                        isSelected && { color: category.color, fontWeight: '700' },
                      ]}>
                      {category.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {isOtherSelected && (
              <>
                <Text style={styles.label}>Custom label</Text>
                <TextInput
                  style={styles.input}
                  value={note}
                  onChangeText={setNote}
                  placeholder="e.g. Gift, Pet supplies"
                  placeholderTextColor={colors.text + '80'}
                />
              </>
            )}
          </>
        )}

        <Text style={styles.label}>{isIncome ? 'Source' : 'Merchant / description'}</Text>
        <TextInput
          style={styles.input}
          value={merchant}
          onChangeText={setMerchant}
          placeholder={isIncome ? 'e.g. Salary, Freelance client, Gift' : 'e.g. Starbucks, Uber, Rent'}
          placeholderTextColor={colors.text + '80'}
        />

        {!isOtherSelected && (
          <>
            <Text style={styles.label}>Note (optional)</Text>
            <TextInput
              style={styles.input}
              value={note}
              onChangeText={setNote}
              placeholder="Add a note"
              placeholderTextColor={colors.text + '80'}
            />
          </>
        )}

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

        <Pressable style={styles.saveButton} onPress={handleSave} disabled={isSaving}>
          <Text style={styles.saveButtonText}>{isSaving ? 'Saving…' : 'Save'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: Spacing.four,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: Spacing.two,
  },
  label: {
    color: colors.text,
    fontSize: typography.body.fontSize,
    marginTop: Spacing.three,
    marginBottom: Spacing.one,
  },
  input: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: Spacing.three,
    color: colors.text,
    fontSize: typography.body.fontSize,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.three,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  categoryIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  categoryChipText: {
    color: colors.text,
    fontSize: typography.body.fontSize,
  },
  error: {
    color: colors.secondaryAccent,
    marginTop: Spacing.three,
  },
  saveButton: {
    backgroundColor: colors.primaryAccent,
    borderRadius: 20,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.four,
  },
  saveButtonText: {
    color: colors.background,
    fontWeight: '700',
    fontSize: typography.body.fontSize,
  },
});
