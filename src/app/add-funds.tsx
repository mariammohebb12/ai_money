import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmountInput } from '@/components/amount-input';
import { ModalCloseButton } from '@/components/modal-close-button';
import { Spacing, colors, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useCurrency } from '@/hooks/use-currency';
import { useSaveSuccess } from '@/hooks/use-save-success';
import { supabase } from '@/lib/supabase';

type Goal = {
  id: string | number;
  name: string;
  target_amount: number;
  current_amount: number;
};

export default function AddFundsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { formatAmount } = useCurrency();
  const { goalId } = useLocalSearchParams<{ goalId: string }>();

  const [goal, setGoal] = useState<Goal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { justSaved, triggerSuccess } = useSaveSuccess(() => router.back());

  useEffect(() => {
    async function fetchGoal() {
      if (!session || !goalId) return;
      const { data, error } = await supabase
        .from('saving_goals')
        .select('id, name, target_amount, current_amount')
        .eq('id', goalId)
        .eq('user_id', session.user.id)
        .single();
      if (error) {
        setErrorMessage(`Couldn't load this goal: ${error.message}`);
      } else {
        setGoal(data);
      }
      setIsLoading(false);
    }

    fetchGoal();
  }, [session, goalId]);

  async function handleAddFunds() {
    setErrorMessage('');

    const parsedAmount = parseFloat(amount);
    if (!amount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage('Please enter a valid amount.');
      return;
    }

    if (!session || !goal) {
      setErrorMessage('You need to be logged in to add funds.');
      return;
    }

    setIsSaving(true);
    const { error } = await supabase
      .from('saving_goals')
      .update({ current_amount: goal.current_amount + parsedAmount })
      .eq('id', goal.id)
      .eq('user_id', session.user.id);
    setIsSaving(false);

    if (error) {
      setErrorMessage(`Save failed: ${error.message}`);
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    triggerSuccess();
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.header}>
            <ModalCloseButton />
          </View>
          <ActivityIndicator style={styles.loading} color={colors.primaryAccent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!goal) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.header}>
            <ModalCloseButton />
            <Text style={styles.title}>Add funds</Text>
          </View>
          <Text style={styles.error}>{errorMessage || 'Goal not found.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <ModalCloseButton />
          <Text style={styles.title}>Add funds</Text>
        </View>
        <Text style={styles.goalName}>{goal.name}</Text>
        <Text style={styles.goalProgress}>
          {formatAmount(goal.current_amount)}
          <Text style={styles.goalProgressTarget}> / {formatAmount(goal.target_amount)}</Text>
        </Text>

        <Text style={styles.label}>Amount to add</Text>
        <AmountInput value={amount} onChangeText={setAmount} autoFocus />

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

        <Pressable
          style={[styles.saveButton, justSaved && styles.saveButtonSuccess]}
          onPress={handleAddFunds}
          disabled={isSaving || justSaved}>
          {justSaved ? (
            <View style={styles.saveButtonSuccessContent}>
              <Feather name="check" size={16} color={colors.background} />
              <Text style={styles.saveButtonText}>Saved</Text>
            </View>
          ) : (
            <Text style={styles.saveButtonText}>{isSaving ? 'Saving…' : 'Add funds'}</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loading: {
    marginTop: Spacing.six,
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
  goalName: {
    color: colors.text,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    opacity: 0.8,
  },
  goalProgress: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginTop: Spacing.one,
    fontVariant: ['tabular-nums'],
  },
  goalProgressTarget: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
    fontWeight: '400',
  },
  label: {
    color: colors.text,
    fontSize: typography.body.fontSize,
    marginTop: Spacing.four,
    marginBottom: Spacing.one,
  },
  input: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: Spacing.three,
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
