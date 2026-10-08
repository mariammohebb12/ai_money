import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Circle, G, Svg } from 'react-native-svg';

import { AiInsightCard } from '@/components/ai-insight-card';
import { ScreenHeader } from '@/components/screen-header';
import { Spacing, colors, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useCurrency } from '@/hooks/use-currency';
import { addDays, startOfMonth, startOfToday, toDateString } from '@/lib/dates';
import { supabase } from '@/lib/supabase';

type Category = {
  id: string | number;
  name: string;
  color: string;
};

type CategoryTotal = {
  category: Category;
  total: number;
};

type TransactionRow = {
  amount: number;
  type: 'income' | 'expense';
  category: Category | null;
};

type PeriodPreset = 'today' | '7d' | '30d' | 'month' | 'custom';

const PERIOD_OPTIONS: { key: PeriodPreset; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: 'month', label: 'This month' },
  { key: 'custom', label: 'Custom' },
];

function getRangeForPreset(preset: PeriodPreset, customStart: Date | null, customEnd: Date | null) {
  const today = startOfToday();
  if (preset === 'today') return { start: today, end: today };
  if (preset === '7d') return { start: addDays(today, -6), end: today };
  if (preset === '30d') return { start: addDays(today, -29), end: today };
  if (preset === 'month') return { start: startOfMonth(today), end: today };
  return { start: customStart ?? addDays(today, -6), end: customEnd ?? today };
}

// The immediately preceding period of the same length, used for the "vs last
// period" comparison — e.g. for a 7-day range, the 7 days right before it.
function getPreviousRange(start: Date, end: Date) {
  const rangeDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const previousEnd = addDays(start, -1);
  const previousStart = addDays(previousEnd, -(rangeDays - 1));
  return { previousStart, previousEnd };
}

function getInsightFocusLabel(preset: PeriodPreset) {
  switch (preset) {
    case 'today':
      return 'today';
    case '7d':
      return 'the last 7 days';
    case '30d':
      return 'the last 30 days';
    case 'month':
      return 'this month';
    default:
      return '';
  }
}

function getComparisonLabel(preset: PeriodPreset) {
  switch (preset) {
    case 'today':
      return 'yesterday';
    case '7d':
      return 'last 7 days';
    case '30d':
      return 'last 30 days';
    default:
      return 'last period';
  }
}

// Net saved as a percentage of income. Null when there's no income to divide
// by, since a rate is meaningless without a denominator.
function computeSavingsRate(income: number, expense: number) {
  if (income <= 0) return null;
  return ((income - expense) / income) * 100;
}

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const CHART_SIZE = 220;
const STROKE_WIDTH = 22;
const RADIUS = (CHART_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function AnalyticsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { formatAmount } = useCurrency();

  const [preset, setPreset] = useState<PeriodPreset>('30d');
  const [customStart, setCustomStart] = useState<Date | null>(null);
  const [customEnd, setCustomEnd] = useState<Date | null>(null);
  const [activeDatePicker, setActiveDatePicker] = useState<'start' | 'end' | null>(null);

  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [previousExpenseTotal, setPreviousExpenseTotal] = useState(0);
  const [previousIncomeTotal, setPreviousIncomeTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | number | null>(null);
  // Budgets are inherently monthly, so this tracks true calendar-month-to-date
  // spend per category — independent of whatever period tab is selected above.
  const [budgetLimits, setBudgetLimits] = useState<Record<string, number>>({});
  const [monthToDateByCategory, setMonthToDateByCategory] = useState<Record<string, number>>({});

  const { start, end } = useMemo(
    () => getRangeForPreset(preset, customStart, customEnd),
    [preset, customStart, customEnd]
  );
  const startTime = start.getTime();
  const endTime = end.getTime();

  const fetchData = useCallback(async () => {
    if (!session) return;
    const rangeStart = new Date(startTime);
    const rangeEnd = new Date(endTime);
    const { previousStart, previousEnd } = getPreviousRange(rangeStart, rangeEnd);
    const monthStart = startOfMonth(startOfToday());
    const today = startOfToday();

    const [currentResult, previousResult, budgetsResult, monthToDateResult] = await Promise.all([
      supabase
        .from('transactions')
        .select('amount, type, category:categories(id, name, color)')
        .eq('user_id', session.user.id)
        .gte('transaction_date', toDateString(rangeStart))
        .lte('transaction_date', toDateString(rangeEnd)),
      supabase
        .from('transactions')
        .select('amount, type')
        .eq('user_id', session.user.id)
        .gte('transaction_date', toDateString(previousStart))
        .lte('transaction_date', toDateString(previousEnd)),
      supabase.from('budgets').select('category_id, monthly_limit').eq('user_id', session.user.id),
      supabase
        .from('transactions')
        .select('amount, category_id')
        .eq('user_id', session.user.id)
        .eq('type', 'expense')
        .gte('transaction_date', toDateString(monthStart))
        .lte('transaction_date', toDateString(today)),
    ]);

    if (currentResult.error) {
      console.error('Failed to fetch transactions:', currentResult.error.message);
      return;
    }
    setTransactions(currentResult.data as unknown as TransactionRow[]);

    if (previousResult.error) {
      console.error('Failed to fetch previous period totals:', previousResult.error.message);
    } else {
      const previousRows = previousResult.data as { amount: number; type: 'income' | 'expense' }[];
      setPreviousExpenseTotal(
        previousRows.filter((row) => row.type === 'expense').reduce((sum, row) => sum + row.amount, 0)
      );
      setPreviousIncomeTotal(
        previousRows.filter((row) => row.type === 'income').reduce((sum, row) => sum + row.amount, 0)
      );
    }

    if (budgetsResult.error) {
      console.error('Failed to fetch budgets:', budgetsResult.error.message);
    } else {
      const limits: Record<string, number> = {};
      for (const row of budgetsResult.data) limits[row.category_id] = row.monthly_limit;
      setBudgetLimits(limits);
    }

    if (monthToDateResult.error) {
      console.error('Failed to fetch month-to-date spending:', monthToDateResult.error.message);
    } else {
      const totals: Record<string, number> = {};
      for (const row of monthToDateResult.data) {
        totals[row.category_id] = (totals[row.category_id] ?? 0) + row.amount;
      }
      setMonthToDateByCategory(totals);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, startTime, endTime]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      fetchData().finally(() => setIsLoading(false));
    }, [fetchData])
  );

  async function handleRefresh() {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  }

  const breakdown = useMemo(() => {
    const totals = new Map<string | number, CategoryTotal>();
    for (const row of transactions) {
      if (row.type !== 'expense' || !row.category) continue;
      const existing = totals.get(row.category.id);
      if (existing) {
        existing.total += row.amount;
      } else {
        totals.set(row.category.id, { category: row.category, total: row.amount });
      }
    }
    return [...totals.values()].sort((a, b) => b.total - a.total);
  }, [transactions]);

  const totalSpending = breakdown.reduce((sum, entry) => sum + entry.total, 0);
  const totalIncome = transactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);

  let changeLabel: string | null = null;
  let changeDirection: 'up' | 'down' | null = null;
  if (previousExpenseTotal > 0) {
    const percentChange = Math.round(((totalSpending - previousExpenseTotal) / previousExpenseTotal) * 100);
    changeDirection = percentChange >= 0 ? 'up' : 'down';
    changeLabel = `${Math.abs(percentChange)}% vs last period`;
  } else if (totalSpending > 0) {
    changeLabel = 'No spending last period';
  }
  const changeColor = changeDirection === 'up' ? colors.secondaryAccent : colors.chartSage;

  const savingsRate = computeSavingsRate(totalIncome, totalSpending);
  const previousSavingsRate = computeSavingsRate(previousIncomeTotal, previousExpenseTotal);

  let savingsHeadline: string;
  let savingsHeadlineColor: string = colors.text;
  if (savingsRate === null) {
    savingsHeadline = totalSpending > 0 ? 'No income this period' : 'No activity yet';
  } else if (savingsRate >= 0) {
    savingsHeadline = `${Math.round(savingsRate)}% saved`;
    savingsHeadlineColor = colors.chartSage;
  } else {
    savingsHeadline = `${Math.round(Math.abs(savingsRate))}% overspent`;
    savingsHeadlineColor = colors.secondaryAccent;
  }

  let savingsChangeLabel: string | null = null;
  let savingsChangeDirection: 'up' | 'down' | null = null;
  const comparisonLabel = getComparisonLabel(preset);
  if (savingsRate !== null && previousSavingsRate !== null) {
    const pointsChange = Math.round(savingsRate - previousSavingsRate);
    if (pointsChange !== 0) {
      savingsChangeDirection = pointsChange > 0 ? 'up' : 'down';
      savingsChangeLabel = `${Math.abs(pointsChange)}% vs ${comparisonLabel}`;
    } else {
      savingsChangeLabel = `Same as ${comparisonLabel}`;
    }
  }
  // Unlike spending, a rising savings rate is the good direction.
  const savingsChangeColor = savingsChangeDirection === 'up' ? colors.chartSage : colors.secondaryAccent;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primaryAccent} />
        }>
        <ScreenHeader title="Analytics" subtitle="Track spending, saving, and trends" />

        <PeriodFilter
          preset={preset}
          onSelectPreset={(p) => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setPreset(p);
            if (p !== 'custom') setActiveDatePicker(null);
          }}
          customStart={customStart}
          customEnd={customEnd}
          activeDatePicker={activeDatePicker}
          onOpenPicker={(which) => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setActiveDatePicker(which);
          }}
          onChangeCustomStart={setCustomStart}
          onChangeCustomEnd={setCustomEnd}
        />

        {!isLoading && preset !== 'custom' && (
          <View style={styles.aiInsightWrap}>
            <AiInsightCard
              cacheKey={`analytics-${preset}`}
              focusLabel={getInsightFocusLabel(preset)}
              hasEnoughData={transactions.length >= 7}
            />
          </View>
        )}

        {isLoading ? (
          <ActivityIndicator style={styles.loading} color={colors.primaryAccent} />
        ) : transactions.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBadge}>
              <Feather name="pie-chart" size={22} color={colors.primaryAccent} />
            </View>
            <Text style={styles.emptyTitle}>Nothing to show yet</Text>
            <Text style={styles.emptySubtitle}>
              Add a few transactions in this period and your breakdown will appear here.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Total spent</Text>
              <Text style={styles.heroAmount}>{formatAmount(totalSpending)}</Text>
              {changeLabel && (
                <View style={styles.changeRow}>
                  {changeDirection && (
                    <Feather
                      name={changeDirection === 'up' ? 'arrow-up-right' : 'arrow-down-right'}
                      size={13}
                      color={changeColor}
                    />
                  )}
                  <Text style={[styles.changeText, changeDirection && { color: changeColor }]}>{changeLabel}</Text>
                </View>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Savings rate</Text>
              <Text style={[styles.heroAmount, { color: savingsHeadlineColor }]}>{savingsHeadline}</Text>
              {savingsChangeLabel && (
                <View style={styles.changeRow}>
                  {savingsChangeDirection && (
                    <Feather
                      name={savingsChangeDirection === 'up' ? 'arrow-up-right' : 'arrow-down-right'}
                      size={13}
                      color={savingsChangeColor}
                    />
                  )}
                  <Text style={[styles.changeText, savingsChangeDirection && { color: savingsChangeColor }]}>
                    {savingsChangeLabel}
                  </Text>
                </View>
              )}

              <View style={styles.supportingRow}>
                <View style={styles.supportingStat}>
                  <Text style={styles.supportingLabel}>Income</Text>
                  <Text style={[styles.supportingAmount, { color: colors.chartSage }]}>
                    {formatAmount(totalIncome)}
                  </Text>
                </View>
                <View style={styles.supportingDivider} />
                <View style={styles.supportingStat}>
                  <Text style={styles.supportingLabel}>Expenses</Text>
                  <Text style={[styles.supportingAmount, { color: colors.secondaryAccent }]}>
                    {formatAmount(totalSpending)}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Spending by category</Text>
                <Pressable style={styles.budgetsLink} onPress={() => router.push('/edit-budgets')}>
                  <Feather name="sliders" size={13} color={colors.primaryAccent} />
                  <Text style={styles.budgetsLinkText}>Budgets</Text>
                </Pressable>
              </View>
              {breakdown.length === 0 ? (
                <Text style={styles.sectionSubtitle}>No expenses in this period.</Text>
              ) : (
                <>
                  <DonutChart
                    data={breakdown}
                    total={totalSpending}
                    selectedCategoryId={selectedCategoryId}
                    onSelectCategory={setSelectedCategoryId}
                  />

                  <View style={styles.legend}>
                    {breakdown.map(({ category, total }) => {
                      const isSelected = selectedCategoryId === category.id;
                      const percent = totalSpending > 0 ? Math.round((total / totalSpending) * 100) : 0;
                      const limit = budgetLimits[category.id];
                      const hasBudget = limit !== undefined;
                      const spentThisMonth = monthToDateByCategory[category.id] ?? 0;
                      const budgetRatio = hasBudget ? spentThisMonth / limit : 0;
                      const isNearOrOverBudget = hasBudget && budgetRatio >= 0.8;
                      return (
                        <View
                          key={category.id}
                          style={[styles.legendRow, isSelected && styles.legendRowSelected]}>
                          <View style={styles.legendRowTop}>
                            <View style={[styles.legendRowDot, { backgroundColor: category.color }]} />
                            <Text style={styles.legendName}>{category.name}</Text>
                            <Text style={styles.legendPercent}>{percent}%</Text>
                            <Text style={styles.legendAmount}>{formatAmount(total)}</Text>
                          </View>
                          <View style={styles.progressTrack}>
                            <View
                              style={[
                                styles.progressFill,
                                { width: `${percent}%`, backgroundColor: category.color },
                              ]}
                            />
                          </View>

                          {hasBudget && (
                            <View style={styles.budgetRow}>
                              <Text style={[styles.budgetText, isNearOrOverBudget && styles.budgetTextWarning]}>
                                This month: {formatAmount(spentThisMonth)} / {formatAmount(limit)} budget
                                {budgetRatio >= 1 ? ' · Over budget' : budgetRatio >= 0.8 ? ' · Close to limit' : ''}
                              </Text>
                              <View style={styles.budgetTrack}>
                                <View
                                  style={[
                                    styles.budgetFill,
                                    isNearOrOverBudget ? styles.budgetFillWarning : styles.budgetFillOk,
                                    { width: `${Math.min(budgetRatio, 1) * 100}%` },
                                  ]}
                                />
                              </View>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                </>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PeriodFilter({
  preset,
  onSelectPreset,
  customStart,
  customEnd,
  activeDatePicker,
  onOpenPicker,
  onChangeCustomStart,
  onChangeCustomEnd,
}: {
  preset: PeriodPreset;
  onSelectPreset: (preset: PeriodPreset) => void;
  customStart: Date | null;
  customEnd: Date | null;
  activeDatePicker: 'start' | 'end' | null;
  onOpenPicker: (which: 'start' | 'end' | null) => void;
  onChangeCustomStart: (date: Date) => void;
  onChangeCustomEnd: (date: Date) => void;
}) {
  const fallbackStart = addDays(startOfToday(), -6);
  const fallbackEnd = startOfToday();

  return (
    <View style={styles.filterWrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {PERIOD_OPTIONS.map((option) => {
          const isSelected = preset === option.key;
          return (
            <Pressable
              key={option.key}
              onPress={() => onSelectPreset(option.key)}
              style={[styles.filterChip, isSelected && styles.filterChipSelected]}>
              <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {preset === 'custom' && (
        <View style={styles.customDateRow}>
          <Pressable style={styles.customDateField} onPress={() => onOpenPicker('start')}>
            <Feather name="calendar" size={12} color={colors.text} />
            <Text style={styles.customDateText}>
              {(customStart ?? fallbackStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </Text>
          </Pressable>
          <Text style={styles.customDateSeparator}>to</Text>
          <Pressable style={styles.customDateField} onPress={() => onOpenPicker('end')}>
            <Feather name="calendar" size={12} color={colors.text} />
            <Text style={styles.customDateText}>
              {(customEnd ?? fallbackEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </Text>
          </Pressable>
        </View>
      )}

      {activeDatePicker && (
        <View style={styles.pickerWrap}>
          <DateTimePicker
            value={activeDatePicker === 'start' ? customStart ?? fallbackStart : customEnd ?? fallbackEnd}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
            maximumDate={new Date()}
            onChange={(event, selectedDate) => {
              if (Platform.OS === 'android') onOpenPicker(null);
              if (event.type === 'set' && selectedDate) {
                if (activeDatePicker === 'start') onChangeCustomStart(selectedDate);
                else onChangeCustomEnd(selectedDate);
              }
            }}
          />
          {Platform.OS === 'ios' && (
            <Pressable style={styles.pickerDoneButton} onPress={() => onOpenPicker(null)}>
              <Text style={styles.pickerDoneText}>Done</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

function DonutChart({
  data,
  total,
  selectedCategoryId,
  onSelectCategory,
}: {
  data: CategoryTotal[];
  total: number;
  selectedCategoryId: string | number | null;
  onSelectCategory: (id: string | number | null) => void;
}) {
  const { formatAmount } = useCurrency();
  // Each category becomes one arc of the ring. Because a circle's stroke can be
  // dashed, drawing a "slice" is just drawing a dash exactly as long as that
  // category's share of the circle's total circumference, then offsetting the
  // next one to start where the previous one ended.
  let cumulativeLength = 0;
  const segments = data.map(({ category, total: categoryTotal }) => {
    const length = total > 0 ? (categoryTotal / total) * CIRCUMFERENCE : 0;
    const segment = { category, length, offset: cumulativeLength };
    cumulativeLength += length;
    return segment;
  });

  const selectedEntry = data.find((entry) => entry.category.id === selectedCategoryId);

  return (
    <View style={styles.chartWrap}>
      <Svg width={CHART_SIZE} height={CHART_SIZE}>
        {/* The circle's dash pattern starts at the 3 o'clock position by default;
            rotating the group -90deg makes the first slice start at the top. */}
        <G rotation="-90" origin={`${CHART_SIZE / 2}, ${CHART_SIZE / 2}`}>
          {segments.map((segment) => {
            const isSelected = segment.category.id === selectedCategoryId;
            const isDimmed = selectedCategoryId !== null && !isSelected;
            return (
              <Circle
                key={segment.category.id}
                cx={CHART_SIZE / 2}
                cy={CHART_SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={segment.category.color}
                strokeWidth={isSelected ? STROKE_WIDTH + 8 : STROKE_WIDTH}
                strokeLinecap="round"
                strokeDasharray={`${segment.length} ${CIRCUMFERENCE - segment.length}`}
                strokeDashoffset={-segment.offset}
                opacity={isDimmed ? 0.35 : 1}
                onPress={() => onSelectCategory(isSelected ? null : segment.category.id)}
              />
            );
          })}
        </G>
      </Svg>

      <View style={styles.chartCenter} pointerEvents="none">
        <Text style={styles.chartCenterLabel}>{selectedEntry ? selectedEntry.category.name : 'Total spent'}</Text>
        <Text style={styles.chartCenterAmount}>
          {formatAmount(selectedEntry ? selectedEntry.total : total)}
        </Text>
      </View>
    </View>
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
  loading: {
    marginTop: Spacing.six,
  },
  filterWrap: {
    marginTop: Spacing.three,
  },
  aiInsightWrap: {
    marginTop: Spacing.four,
  },
  filterRow: {
    gap: Spacing.two,
  },
  filterChip: {
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  filterChipSelected: {
    backgroundColor: colors.primaryAccent + '1F',
    borderColor: colors.primaryAccent,
  },
  filterChipText: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
  },
  filterChipTextSelected: {
    color: colors.primaryAccent,
    fontWeight: '700',
    opacity: 1,
  },
  customDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  customDateField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  customDateText: {
    color: colors.text,
    fontSize: typography.caption.fontSize,
  },
  customDateSeparator: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
  },
  pickerWrap: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    marginTop: Spacing.two,
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
  section: {
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    padding: Spacing.three,
    marginTop: Spacing.four,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: typography.sectionLabel.fontSize,
    fontWeight: typography.sectionLabel.fontWeight,
    textTransform: typography.sectionLabel.textTransform,
    letterSpacing: typography.sectionLabel.letterSpacing,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  budgetsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  budgetsLinkText: {
    color: colors.primaryAccent,
    fontSize: 13,
    fontWeight: '700',
  },
  sectionSubtitle: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
    marginTop: 2,
  },
  heroAmount: {
    color: colors.text,
    fontSize: typography.heroNumber.fontSize,
    fontWeight: typography.heroNumber.fontWeight,
    marginTop: Spacing.one,
    fontVariant: ['tabular-nums'],
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: Spacing.one,
  },
  changeText: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
  },
  supportingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.three,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.background,
  },
  supportingStat: {
    flex: 1,
  },
  supportingDivider: {
    width: StyleSheet.hairlineWidth,
    height: 32,
    backgroundColor: colors.background,
    marginHorizontal: Spacing.three,
  },
  supportingLabel: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
  },
  supportingAmount: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  chartWrap: {
    width: CHART_SIZE,
    height: CHART_SIZE,
    alignSelf: 'center',
    marginTop: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartCenter: {
    position: 'absolute',
    alignItems: 'center',
    maxWidth: CHART_SIZE - STROKE_WIDTH * 2 - Spacing.three,
  },
  chartCenterLabel: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
    textAlign: 'center',
  },
  chartCenterAmount: {
    color: colors.text,
    fontSize: 30,
    fontWeight: typography.heroNumber.fontWeight,
    marginTop: Spacing.one,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  legend: {
    marginTop: Spacing.four,
    gap: Spacing.three,
  },
  legendRow: {
    backgroundColor: colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.text + '14',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  legendRowSelected: {
    borderWidth: 1.5,
    borderColor: colors.primaryAccent,
  },
  legendRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  legendRowDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendName: {
    flex: 1,
    color: colors.text,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  legendPercent: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
  },
  legendAmount: {
    color: colors.text,
    fontSize: typography.body.fontSize,
    fontWeight: '700',
    minWidth: 72,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.cardBackground,
    marginTop: Spacing.two,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  budgetRow: {
    marginTop: Spacing.two,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.text + '14',
  },
  budgetText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  budgetTextWarning: {
    color: colors.secondaryAccent,
  },
  budgetTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.cardBackground,
    marginTop: Spacing.one,
    overflow: 'hidden',
  },
  budgetFill: {
    height: '100%',
    borderRadius: 2,
  },
  budgetFillOk: {
    backgroundColor: colors.chartSage,
  },
  budgetFillWarning: {
    backgroundColor: colors.secondaryAccent,
  },
  emptyState: {
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
