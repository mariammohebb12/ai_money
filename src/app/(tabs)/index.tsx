import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AiInsightCard } from '@/components/ai-insight-card';
import { ScreenHeader } from '@/components/screen-header';
import { Spacing, colors, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useCountUp } from '@/hooks/use-count-up';
import { useCurrency } from '@/hooks/use-currency';
import { addDays, describeDueDate, fromDateString, getGreeting, startOfToday, toDateString } from '@/lib/dates';
import { normalizeGoalIcon } from '@/lib/goal-icons';
import { supabase } from '@/lib/supabase';

type Goal = {
  id: string | number;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  icon: string | null;
};

type Bill = {
  id: string | number;
  name: string;
  amount: number;
  due_date: string;
};

const MAX_HOME_BILLS = 4;

export default function HomeScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { formatAmount } = useCurrency();
  const today = new Date();
  const dateLabel = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [monthlyChange, setMonthlyChange] = useState(0);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [upcomingBills, setUpcomingBills] = useState<Bill[]>([]);
  const [unpaidBillCount, setUnpaidBillCount] = useState(0);
  const [recentTransactionCount, setRecentTransactionCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!session) return;

    async function fetchTransactions() {
        const { data, error } = await supabase
          .from('transactions')
          .select('amount, type, created_at')
          .eq('user_id', session!.user.id);
        if (error) {
          console.error('Failed to fetch transactions:', error.message);
          return;
        }

        const now = new Date();
        let income = 0;
        let expenses = 0;
        let monthNet = 0;

        for (const transaction of data) {
          const signedAmount = transaction.type === 'income' ? transaction.amount : -transaction.amount;

          if (transaction.type === 'income') {
            income += transaction.amount;
          } else {
            expenses += transaction.amount;
          }

          const createdAt = new Date(transaction.created_at);
          const isThisMonth =
            createdAt.getFullYear() === now.getFullYear() && createdAt.getMonth() === now.getMonth();
          if (isThisMonth) {
            monthNet += signedAmount;
          }
        }

        setTotalIncome(income);
        setTotalExpenses(expenses);
        setMonthlyChange(monthNet);
      }

      async function fetchGoals() {
        const { data, error } = await supabase
          .from('saving_goals')
          .select('id, name, target_amount, current_amount, target_date, icon')
          .eq('user_id', session!.user.id)
          .order('created_at', { ascending: false });
        if (error) {
          console.error('Failed to fetch savings goals:', error.message);
          return;
        }
        setGoals(data);
      }

      async function fetchBills() {
        const { data, error } = await supabase
          .from('bills')
          .select('id, name, amount, due_date')
          .eq('user_id', session!.user.id)
          .eq('is_paid', false)
          .order('due_date', { ascending: true });
        if (error) {
          console.error('Failed to fetch bills:', error.message);
          return;
        }
        setUpcomingBills(data.slice(0, MAX_HOME_BILLS));
        setUnpaidBillCount(data.length);
      }

      async function fetchRecentTransactionCount() {
        const sevenDaysAgo = addDays(startOfToday(), -6);
        const { count, error } = await supabase
          .from('transactions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', session!.user.id)
          .gte('transaction_date', toDateString(sevenDaysAgo));
        if (error) {
          console.error('Failed to fetch recent transaction count:', error.message);
          return;
        }
        setRecentTransactionCount(count ?? 0);
      }

    await Promise.all([fetchTransactions(), fetchGoals(), fetchBills(), fetchRecentTransactionCount()]);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      fetchAll().finally(() => setIsLoading(false));
    }, [fetchAll])
  );

  async function handleRefresh() {
    setIsRefreshing(true);
    await fetchAll();
    setIsRefreshing(false);
  }

  const balance = totalIncome - totalExpenses;
  const animatedBalance = useCountUp(balance);
  const changeSign = monthlyChange >= 0 ? '+' : '-';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primaryAccent} />
        }>
        <ScreenHeader title={getGreeting()} subtitle={dateLabel} />

      {isLoading ? (
        <ActivityIndicator style={styles.loading} color={colors.primaryAccent} />
      ) : (
      <>
      <View style={styles.balanceSection}>
        <Text style={styles.label}>Available balance</Text>
        <Text style={styles.balanceAmount}>{formatAmount(animatedBalance)}</Text>
        <Text style={styles.balanceChange}>
          {changeSign}
          {formatAmount(Math.abs(monthlyChange))} this month
        </Text>
      </View>

      <View style={styles.flowSection}>
        <View style={styles.flowBlock}>
          <View style={[styles.flowIconBadge, { backgroundColor: colors.chartSage + '1F' }]}>
            <Feather name="trending-up" size={15} color={colors.chartSage} />
          </View>
          <Text style={styles.flowLabel}>Income</Text>
          <Text
            style={[styles.flowAmount, { color: colors.chartSage }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}>
            {formatAmount(totalIncome)}
          </Text>
        </View>
        <View style={styles.flowDivider} />
        <View style={styles.flowBlock}>
          <View style={[styles.flowIconBadge, { backgroundColor: colors.secondaryAccent + '1F' }]}>
            <Feather name="trending-down" size={15} color={colors.secondaryAccent} />
          </View>
          <Text style={styles.flowLabel}>Expenses</Text>
          <Text
            style={[styles.flowAmount, { color: colors.secondaryAccent }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}>
            {formatAmount(totalExpenses)}
          </Text>
        </View>
        <View style={styles.flowDivider} />
        <View style={styles.flowBlock}>
          <View style={[styles.flowIconBadge, { backgroundColor: colors.primaryAccent + '1F' }]}>
            <Feather name="save" size={15} color={colors.primaryAccent} />
          </View>
          <Text style={styles.flowLabel}>Saved</Text>
          <Text
            style={[styles.flowAmount, { color: colors.primaryAccent }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}>
            {formatAmount(balance)}
          </Text>
        </View>
      </View>

      <View style={styles.aiInsightWrap}>
        <AiInsightCard cacheKey="home-v3" focusLabel="the last 7 days" hasEnoughData={recentTransactionCount >= 7} />
      </View>

      <View style={styles.goalsHeader}>
        <Text style={styles.goalsTitle}>Savings goals</Text>
        <Pressable style={styles.addGoalButton} onPress={() => router.push('/add-goal')}>
          <Feather name="plus" size={16} color={colors.background} />
        </Pressable>
      </View>

      {goals.length === 0 ? (
        <View style={styles.goalsEmpty}>
          <View style={styles.goalsEmptyIconBadge}>
            <Feather name="target" size={20} color={colors.primaryAccent} />
          </View>
          <Text style={styles.goalsEmptyText}>No goals yet — add one to start saving toward something.</Text>
        </View>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.goalsScroll}>
            {goals.map((goal) => (
              <GoalCard key={goal.id} goal={goal} />
            ))}
          </ScrollView>
          <Pressable onPress={() => router.push('/goals')}>
            <Text style={styles.seeAllLink}>Manage goals</Text>
          </Pressable>
        </>
      )}

      <View style={styles.billsHeader}>
        <Text style={styles.goalsTitle}>Bills</Text>
        <Pressable style={styles.addGoalButton} onPress={() => router.push('/add-bill')}>
          <Feather name="plus" size={16} color={colors.background} />
        </Pressable>
      </View>

      {upcomingBills.length === 0 ? (
        <View style={styles.goalsEmpty}>
          <View style={styles.goalsEmptyIconBadge}>
            <Feather name="file-text" size={20} color={colors.primaryAccent} />
          </View>
          <Text style={styles.goalsEmptyText}>No upcoming bills — add one to keep track of due dates.</Text>
        </View>
      ) : (
        <View style={styles.billsList}>
          {upcomingBills.map((bill) => (
            <BillRow key={bill.id} bill={bill} />
          ))}
          <Pressable onPress={() => router.push('/bills')}>
            <Text style={styles.seeAllLink}>
              {unpaidBillCount > upcomingBills.length ? `See all ${unpaidBillCount} bills` : 'Manage bills'}
            </Text>
          </Pressable>
        </View>
      )}
      </>
      )}
      </ScrollView>
    </SafeAreaView>
  );
}

function BillRow({ bill }: { bill: Bill }) {
  const { formatAmount } = useCurrency();
  const { label, isOverdue } = describeDueDate(fromDateString(bill.due_date));

  return (
    <View style={[styles.billRow, isOverdue && styles.billRowOverdue]}>
      <View style={[styles.billIconBadge, isOverdue && styles.billIconBadgeOverdue]}>
        <Feather
          name={isOverdue ? 'alert-circle' : 'file-text'}
          size={16}
          color={isOverdue ? colors.secondaryAccent : colors.primaryAccent}
        />
      </View>
      <View style={styles.billRowText}>
        <Text style={styles.billName}>{bill.name}</Text>
        <Text style={[styles.billDue, isOverdue && styles.billDueOverdue]}>{label}</Text>
      </View>
      <Text style={styles.billAmount}>{formatAmount(bill.amount)}</Text>
    </View>
  );
}

function GoalCard({ goal }: { goal: Goal }) {
  const router = useRouter();
  const { formatAmount } = useCurrency();
  const progress = goal.target_amount > 0 ? Math.min(goal.current_amount / goal.target_amount, 1) : 0;
  const dateLabel = goal.target_date
    ? new Date(goal.target_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <View style={styles.goalCard}>
      <View>
        <View style={styles.goalCardHeader}>
          <View style={styles.goalIconBadge}>
            <MaterialCommunityIcons
              name={(normalizeGoalIcon(goal.icon) ?? 'target') as any}
              size={12}
              color={colors.primaryAccent}
            />
          </View>
          <Text style={styles.goalName} numberOfLines={1}>
            {goal.name}
          </Text>
          <Pressable
            style={styles.addFundsButton}
            onPress={() => router.push({ pathname: '/add-funds', params: { goalId: String(goal.id) } })}>
            <Feather name="plus" size={12} color={colors.primaryAccent} />
          </Pressable>
        </View>
        <Text style={styles.goalAmount} numberOfLines={1}>
          {formatAmount(goal.current_amount)}
          <Text style={styles.goalAmountTarget}> / {formatAmount(goal.target_amount)}</Text>
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      </View>
      <View style={styles.goalDateRow}>
        {dateLabel ? (
          <>
            <Feather name="calendar" size={10} color={colors.text} style={styles.goalDateIcon} />
            <Text style={styles.goalDate}>{dateLabel}</Text>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: Spacing.four,
    paddingBottom: Spacing.six,
  },
  loading: {
    marginTop: Spacing.six,
  },
  balanceSection: {
    marginTop: Spacing.four,
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    padding: Spacing.four,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  label: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
  },
  balanceAmount: {
    color: colors.text,
    fontSize: typography.heroNumber.fontSize,
    fontWeight: typography.heroNumber.fontWeight,
    marginTop: Spacing.one,
    fontVariant: ['tabular-nums'],
  },
  balanceChange: {
    color: colors.secondaryAccent,
    fontSize: 14,
    marginTop: Spacing.one,
    fontVariant: ['tabular-nums'],
  },
  flowSection: {
    marginTop: Spacing.five,
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  flowBlock: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.one,
  },
  flowDivider: {
    width: StyleSheet.hairlineWidth,
    height: 40,
    backgroundColor: colors.background,
  },
  flowIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flowLabel: {
    color: colors.textMuted,
    fontSize: 12,
  },
  flowAmount: {
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    paddingHorizontal: Spacing.one,
  },
  goalsHeader: {
    marginTop: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  goalsTitle: {
    color: colors.textMuted,
    fontSize: typography.sectionLabel.fontSize,
    fontWeight: typography.sectionLabel.fontWeight,
    textTransform: typography.sectionLabel.textTransform,
    letterSpacing: typography.sectionLabel.letterSpacing,
  },
  addGoalButton: {
    backgroundColor: colors.primaryAccent,
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalsEmpty: {
    marginTop: Spacing.three,
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    padding: Spacing.four,
    alignItems: 'center',
  },
  goalsEmptyIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryAccent + '1F',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  goalsEmptyText: {
    color: colors.textMuted,
    fontSize: typography.body.fontSize,
    textAlign: 'center',
  },
  goalsScroll: {
    marginTop: Spacing.three,
    gap: Spacing.three,
    paddingRight: Spacing.four,
    alignItems: 'flex-start',
  },
  goalCard: {
    width: 208,
    height: 100,
    backgroundColor: colors.cardBackground,
    borderRadius: 18,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  goalCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.one,
  },
  goalIconBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primaryAccent + '1F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalName: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  addFundsButton: {
    backgroundColor: colors.background,
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalAmount: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: Spacing.one,
    fontVariant: ['tabular-nums'],
  },
  goalAmountTarget: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '400',
  },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.background,
    marginTop: Spacing.one,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.chartSage,
  },
  goalDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 14,
    marginTop: Spacing.one,
  },
  goalDateIcon: {
    marginRight: 4,
  },
  goalDate: {
    color: colors.textMuted,
    fontSize: 10,
  },
  billsHeader: {
    marginTop: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  billsList: {
    marginTop: Spacing.three,
    gap: Spacing.two,
  },
  billRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    padding: Spacing.three,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  billRowOverdue: {
    borderWidth: 1.5,
    borderColor: colors.secondaryAccent,
  },
  billIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryAccent + '1F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  billIconBadgeOverdue: {
    backgroundColor: colors.secondaryAccent + '26',
  },
  billRowText: {
    flex: 1,
  },
  billName: {
    color: colors.text,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  billDue: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
    marginTop: 2,
  },
  billDueOverdue: {
    color: colors.secondaryAccent,
    opacity: 1,
    fontWeight: '700',
  },
  billAmount: {
    color: colors.text,
    fontSize: typography.body.fontSize,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  seeAllLink: {
    color: colors.primaryAccent,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: Spacing.one,
  },
  aiInsightWrap: {
    marginTop: Spacing.five,
  },
});
