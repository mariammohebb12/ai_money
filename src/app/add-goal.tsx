import DateTimePicker from '@react-native-community/datetimepicker';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmountInput } from '@/components/amount-input';
import { ModalCloseButton } from '@/components/modal-close-button';
import { Spacing, colors, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useSaveSuccess } from '@/hooks/use-save-success';
import { toDateString } from '@/lib/dates';
import { GOAL_ICON_OPTIONS, type GoalIcon } from '@/lib/goal-icons';
import { supabase } from '@/lib/supabase';

export default function AddGoalScreen() {
  const router = useRouter();
  const { session } = useAuth();

  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [startingAmount, setStartingAmount] = useState('');
  const [targetDate, setTargetDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { justSaved, triggerSuccess } = useSaveSuccess(() => router.back());
  const [icon, setIcon] = useState<GoalIcon>(GOAL_ICON_OPTIONS[0]);

  async function handleSave() {
    setErrorMessage('');

    if (!name.trim()) {
      setErrorMessage('Please name your goal.');
      return;
    }

    const parsedTarget = parseFloat(targetAmount);
    if (!targetAmount || Number.isNaN(parsedTarget) || parsedTarget <= 0) {
      setErrorMessage('Please enter a valid target amount.');
      return;
    }

    let parsedStarting = 0;
    if (startingAmount.trim()) {
      parsedStarting = parseFloat(startingAmount);
      if (Number.isNaN(parsedStarting) || parsedStarting < 0) {
        setErrorMessage('Starting amount should be zero or more.');
        return;
      }
    }

    const parsedDate = targetDate ? toDateString(targetDate) : null;

    if (!session) {
      setErrorMessage('You need to be logged in to save a goal.');
      return;
    }

    setIsSaving(true);
    const { error } = await supabase.from('saving_goals').insert({
      user_id: session.user.id,
      name: name.trim(),
      target_amount: parsedTarget,
      current_amount: parsedStarting,
      target_date: parsedDate,
      icon,
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
          <Text style={styles.title}>New savings goal</Text>
        </View>

        <Text style={styles.label}>Icon (optional)</Text>
        <View style={styles.iconRow}>
          {GOAL_ICON_OPTIONS.map((option) => {
            const isSelected = option === icon;
            return (
              <Pressable
                key={option}
                onPress={() => setIcon(option)}
                style={[styles.iconOption, isSelected && styles.iconOptionSelected]}>
                <Text style={styles.iconOptionEmoji}>{option}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Goal name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Emergency fund, Trip to Japan"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.label}>Target amount</Text>
        <AmountInput value={targetAmount} onChangeText={setTargetAmount} />

        <Text style={styles.label}>Starting amount (optional)</Text>
        <TextInput
          style={styles.input}
          value={startingAmount}
          onChangeText={setStartingAmount}
          placeholder="0.00"
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>Target date (optional)</Text>
        <Pressable style={styles.input} onPress={() => setShowDatePicker(true)}>
          <Text style={targetDate ? styles.dateValue : styles.datePlaceholder}>
            {targetDate
              ? targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : 'Select a date'}
          </Text>
        </Pressable>

        {showDatePicker && (
          <View style={styles.pickerWrap}>
            <DateTimePicker
              value={targetDate ?? new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
              onChange={(event, selectedDate) => {
                if (Platform.OS === 'android') {
                  setShowDatePicker(false);
                }
                if (event.type === 'set' && selectedDate) {
                  setTargetDate(selectedDate);
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
  datePlaceholder: {
    color: colors.textMuted,
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
  iconRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  iconOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardBackground,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  iconOptionSelected: {
    backgroundColor: colors.primaryAccent + '26',
    borderColor: colors.primaryAccent,
  },
  iconOptionEmoji: {
    fontSize: 20,
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
