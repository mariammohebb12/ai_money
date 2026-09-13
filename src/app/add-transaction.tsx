import DateTimePicker from '@react-native-community/datetimepicker';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmountInput } from '@/components/amount-input';
import { ModalCloseButton } from '@/components/modal-close-button';
import { Spacing, colors, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useSaveSuccess } from '@/hooks/use-save-success';
import { toDateString } from '@/lib/dates';
import { supabase } from '@/lib/supabase';

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
  const { session } = useAuth();

  const [amount, setAmount] = useState('');
  const [isIncome, setIsIncome] = useState(false);
  const [merchant, setMerchant] = useState('');
  const [note, setNote] = useState('');
  const [transactionDate, setTransactionDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | number | null>(null);
  const [incomeCategoryId, setIncomeCategoryId] = useState<string | number | null>(null);

  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { justSaved, triggerSuccess } = useSaveSuccess(() => router.back());

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

    if (!session) {
      setErrorMessage('You need to be logged in to save a transaction.');
      return;
    }

    setIsSaving(true);
    const { error } = await supabase.from('transactions').insert({
      user_id: session.user.id,
      amount: parsedAmount,
      type: isIncome ? 'income' : 'expense',
      category_id: categoryId,
      merchant,
      note: note || null,
      transaction_date: toDateString(transactionDate),
    });
    setIsSaving(false);

    if (error) {
      setErrorMessage(`Save failed: ${error.message}`);
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    triggerSuccess();
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <ModalCloseButton />
          <Text style={styles.title}>Add transaction</Text>
        </View>

        <Text style={styles.label}>Amount</Text>
        <AmountInput value={amount} onChangeText={setAmount} autoFocus />

        <Text style={styles.label}>Date</Text>
        <Pressable style={styles.input} onPress={() => setShowDatePicker(true)}>
          <Text style={styles.dateValue}>
            {transactionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
        </Pressable>

        {showDatePicker && (
          <View style={styles.pickerWrap}>
            <DateTimePicker
              value={transactionDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
              maximumDate={new Date()}
              onChange={(event, selectedDate) => {
                if (Platform.OS === 'android') {
                  setShowDatePicker(false);
                }
                if (event.type === 'set' && selectedDate) {
                  setTransactionDate(selectedDate);
                }
              }}
            />
            {Platform.OS === 'ios' && (
              <Pressable style={styles.pickerDoneButton} onPress={() => setShowDatePicker(false)}>
                <Text style={styles.pickerDoneText}>Done</Text>
              </Pressable>
            )}
          </View>
        )}

        <View style={styles.toggleRow}>
          <Text style={styles.label}>{isIncome ? 'Income' : 'Expense'}</Text>
          <Switch
            value={isIncome}
            onValueChange={(value) => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setIsIncome(value);
            }}
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
                  placeholderTextColor={colors.textMuted}
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
          placeholderTextColor={colors.textMuted}
        />

        {!isOtherSelected && (
          <>
            <Text style={styles.label}>Note (optional)</Text>
            <TextInput
              style={styles.input}
              value={note}
              onChangeText={setNote}
              placeholder="Add a note"
              placeholderTextColor={colors.textMuted}
            />
          </>
        )}

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

        <Pressable
          style={[styles.saveButton, justSaved && styles.saveButtonSuccess]}
          onPress={handleSave}
          disabled={isSaving || justSaved}>
          {justSaved ? (
            <View style={styles.saveButtonSuccessContent}>
              <Feather name="check" size={16} color={colors.background} />
              <Text style={styles.saveButtonText}>Saved</Text>
            </View>
          ) : (
            <Text style={styles.saveButtonText}>{isSaving ? 'Saving…' : 'Save'}</Text>
          )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginBottom: Spacing.two,
  },
  title: {
    color: colors.text,
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
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
  dateValue: {
    color: colors.text,
    fontSize: typography.body.fontSize,
  },
  pickerWrap: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    marginTop: Spacing.one,
    overflow: 'hidden',
  },
  pickerDoneButton: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.background,
  },
  pickerDoneText: {
    color: colors.primaryAccent,
    fontWeight: '700',
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
  saveButtonSuccess: {
    backgroundColor: colors.chartSage,
  },
  saveButtonSuccessContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  saveButtonText: {
    color: colors.background,
    fontWeight: '700',
    fontSize: typography.body.fontSize,
  },
});
