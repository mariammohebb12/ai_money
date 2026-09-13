import DateTimePicker from '@react-native-community/datetimepicker';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmountInput } from '@/components/amount-input';
import { ModalCloseButton } from '@/components/modal-close-button';
import { OptionPickerField } from '@/components/option-picker-field';
import { Spacing, colors, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useSaveSuccess } from '@/hooks/use-save-success';
import { REPEAT_INTERVAL_OPTIONS, type RepeatInterval } from '@/lib/bill-recurrence';
import { toDateString } from '@/lib/dates';
import { supabase } from '@/lib/supabase';

export default function AddBillScreen() {
  const router = useRouter();
  const { session } = useAuth();

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [repeatInterval, setRepeatInterval] = useState<RepeatInterval>('none');

  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { justSaved, triggerSuccess } = useSaveSuccess(() => router.back());

  async function handleSave() {
    setErrorMessage('');

    if (!name.trim()) {
      setErrorMessage('Please name this bill.');
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (!amount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage('Please enter a valid amount.');
      return;
    }

    if (!session) {
      setErrorMessage('You need to be logged in to save a bill.');
      return;
    }

    setIsSaving(true);
    const { error } = await supabase.from('bills').insert({
      user_id: session.user.id,
      name: name.trim(),
      amount: parsedAmount,
      due_date: toDateString(dueDate),
      is_paid: false,
      repeat_interval: repeatInterval,
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
          <Text style={styles.title}>New bill</Text>
        </View>

        <Text style={styles.label}>Bill name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Car installment, Rent, Netflix"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.label}>Amount</Text>
        <AmountInput value={amount} onChangeText={setAmount} />

        <Text style={styles.label}>Due date</Text>
        <Pressable style={styles.input} onPress={() => setShowDatePicker(true)}>
          <Text style={styles.dateValue}>
            {dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
        </Pressable>

        {showDatePicker && (
          <View style={styles.pickerWrap}>
            <DateTimePicker
              value={dueDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
              onChange={(event, selectedDate) => {
                if (Platform.OS === 'android') {
                  setShowDatePicker(false);
                }
                if (event.type === 'set' && selectedDate) {
                  setDueDate(selectedDate);
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

        <Text style={styles.label}>Frequency</Text>
        <OptionPickerField
          label="Frequency"
          value={repeatInterval}
          options={REPEAT_INTERVAL_OPTIONS}
          onChange={setRepeatInterval}
        />

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
