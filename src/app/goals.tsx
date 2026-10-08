import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ModalCloseButton } from '@/components/modal-close-button';
import { Spacing, colors, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useCurrency } from '@/hooks/use-currency';
import { normalizeGoalIcon } from '@/lib/goal-icons';
import { supabase } from '@/lib/supabase';

type Goal = {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  icon: string | null;
};

export default function GoalsScreen() {
  const router = useRouter();
  const { session } = useAuth();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchGoals = useCallback(async () => {
    if (!session) return;
    const { data, error } = await supabase
      .from('saving_goals')
      .select('id, name, target_amount, current_amount, target_date, icon')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Failed to fetch savings goals:', error.message);
      setIsLoading(false);
      return;
    }
    setGoals(data);
    setIsLoading(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      fetchGoals();
    }, [fetchGoals])
  );

  async function handleRefresh() {
    setIsRefreshing(true);
    await fetchGoals();
    setIsRefreshing(false);
  }

  function handleDelete(goal: Goal) {
    Alert.alert('Delete goal?', `This permanently deletes "${goal.name}" and its progress. This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => confirmDelete(goal.id) },
    ]);
  }

  async function confirmDelete(goalId: string) {
    if (!session) return;
    setDeletingId(goalId);
    const { error } = await supabase
      .from('saving_goals')
      .delete()
      .eq('id', goalId)
      .eq('user_id', session.user.id);
    setDeletingId(null);
    if (error) {
      console.error('Failed to delete goal:', error.message);
      return;
    }
    setGoals((prev) => prev.filter((goal) => goal.id !== goalId));
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <ModalCloseButton />
        <Text style={[styles.title, styles.titleFlex]}>Savings goals</Text>
        <Pressable style={styles.addButton} onPress={() => router.push('/add-goal')}>
          <Feather name="plus" size={20} color={colors.background} />
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.loading} color={colors.primaryAccent} />
      ) : goals.length === 0 ? (
        <ScrollView
          style={styles.emptyScrollFlex}
          contentContainerStyle={styles.emptyState}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primaryAccent} />
          }>
          <View style={styles.emptyIconBadge}>
            <Feather name="target" size={22} color={colors.primaryAccent} />
          </View>
          <Text style={styles.emptyTitle}>No goals yet</Text>
          <Text style={styles.emptySubtitle}>Add a goal to start saving toward something.</Text>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primaryAccent} />
          }>
          {goals.map((goal) => (
            <GoalRow
              key={goal.id}
              goal={goal}
              isDeleting={deletingId === goal.id}
              onAddFunds={() => router.push({ pathname: '/add-funds', params: { goalId: goal.id } })}
              onDelete={() => handleDelete(goal)}
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function GoalRow({
  goal,
  isDeleting,
  onAddFunds,
  onDelete,
}: {
  goal: Goal;
  isDeleting: boolean;
  onAddFunds: () => void;
  onDelete: () => void;
}) {
  const { formatAmount } = useCurrency();
  const progress = goal.target_amount > 0 ? Math.min(goal.current_amount / goal.target_amount, 1) : 0;
  const dateLabel = goal.target_date
    ? new Date(goal.target_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <View style={styles.iconBadge}>
          <MaterialCommunityIcons
            name={(normalizeGoalIcon(goal.icon) ?? 'target') as any}
            size={16}
            color={colors.primaryAccent}
          />
        </View>
        <View style={styles.rowText}>
          <Text style={styles.goalName} numberOfLines={1}>
            {goal.name}
          </Text>
          <Text style={styles.goalAmount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {formatAmount(goal.current_amount)}
            <Text style={styles.goalAmountTarget}> / {formatAmount(goal.target_amount)}</Text>
          </Text>
        </View>
        <View style={styles.rowActions}>
          <Pressable style={styles.addFundsButton} onPress={onAddFunds}>
            <Feather name="plus" size={14} color={colors.primaryAccent} />
          </Pressable>
          <Pressable style={styles.deleteButton} onPress={onDelete} disabled={isDeleting}>
            <Feather name="trash-2" size={14} color={colors.secondaryAccent} />
          </Pressable>
        </View>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      {dateLabel ? (
        <View style={styles.dateRow}>
          <Feather name="calendar" size={11} color={colors.textMuted} style={styles.dateIcon} />
          <Text style={styles.dateText}>Target: {dateLabel}</Text>
        </View>
      ) : null}
    </View>
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
  titleFlex: {
    flex: 1,
  },
  addButton: {
    backgroundColor: colors.primaryAccent,
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: {
    marginTop: Spacing.five,
  },
  list: {
    marginTop: Spacing.four,
    gap: Spacing.two,
    paddingBottom: Spacing.six,
  },
  row: {
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    padding: Spacing.three,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryAccent + '1F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  goalName: {
    color: colors.text,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  goalAmount: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  goalAmountTarget: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
    fontWeight: '400',
  },
  rowActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  addFundsButton: {
    backgroundColor: colors.background,
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    backgroundColor: colors.secondaryAccent + '1A',
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.background,
    marginTop: Spacing.three,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.chartSage,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  dateIcon: {
    marginRight: 4,
  },
  dateText: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
  },
  emptyScrollFlex: {
    flex: 1,
  },
  emptyState: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.six,
    paddingHorizontal: Spacing.four,
  },
  emptyIconBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryAccent + '1F',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.three,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    color: colors.textMuted,
    fontSize: typography.body.fontSize,
    marginTop: Spacing.one,
    textAlign: 'center',
  },
});
