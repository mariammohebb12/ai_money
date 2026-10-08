import { Feather, Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { Spacing, colors, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useCurrency } from '@/hooks/use-currency';
import { fromDateString, startOfToday } from '@/lib/dates';
import { supabase } from '@/lib/supabase';

type Category = {
  id: string | number;
  name: string;
  color: string;
  icon: string;
};

type Transaction = {
  id: string | number;
  amount: number;
  type: 'income' | 'expense';
  merchant: string;
  transaction_date: string;
  category: Category | null;
};

// Adds an alpha suffix to a "#RRGGBB" hex color, e.g. withAlpha('#C1613B', '33') -> '#C1613B33'.
function withAlpha(hex: string, alpha: string) {
  return `${hex}${alpha}`;
}

// Buckets a transaction date relative to today for the date-grouped list —
// "Today"/"Yesterday"/"This week" for recent activity, "This month" for the
// rest of the current month, then a "Month Year" label for anything older.
function getSectionTitle(date: Date, today: Date) {
  const diffDays = Math.round((today.getTime() - date.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return 'This week';
  if (date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth()) return 'This month';
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export default function TransactionsScreen() {
  const router = useRouter();
  const { session } = useAuth();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | number | 'all'>('all');

  const fetchTransactions = useCallback(async () => {
    if (!session) return;
    const { data, error } = await supabase
      .from('transactions')
      .select('id, amount, type, merchant, transaction_date, category:categories(id, name, color, icon)')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Failed to fetch transactions:', error.message);
    } else {
      setTransactions(data as unknown as Transaction[]);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      fetchTransactions().finally(() => setIsLoading(false));
    }, [fetchTransactions])
  );

  async function handleRefresh() {
    setIsRefreshing(true);
    await fetchTransactions();
    setIsRefreshing(false);
  }

  // The distinct categories actually present in this user's transactions,
  // used to build the filter row — rather than every category that exists,
  // which would include ones they've never used.
  const availableCategories = useMemo(() => {
    const seen = new Map<string | number, Category>();
    for (const transaction of transactions) {
      if (transaction.category && !seen.has(transaction.category.id)) {
        seen.set(transaction.category.id, transaction.category);
      }
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    if (selectedCategoryId === 'all') return transactions;
    return transactions.filter((transaction) => transaction.category?.id === selectedCategoryId);
  }, [transactions, selectedCategoryId]);

  const sections = useMemo(() => {
    const sorted = [...filteredTransactions].sort((a, b) => (a.transaction_date < b.transaction_date ? 1 : -1));
    const today = startOfToday();
    const order: string[] = [];
    const grouped = new Map<string, Transaction[]>();
    for (const transaction of sorted) {
      const title = getSectionTitle(fromDateString(transaction.transaction_date), today);
      if (!grouped.has(title)) {
        grouped.set(title, []);
        order.push(title);
      }
      grouped.get(title)!.push(transaction);
    }
    return order.map((title) => ({ title, data: grouped.get(title)! }));
  }, [filteredTransactions]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <ScreenHeader title="Transactions" subtitle="Every expense and income, in order" />
        <Pressable style={styles.addButton} onPress={() => router.push('/add-transaction')}>
          <Feather name="plus" size={20} color={colors.background} />
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.loading} color={colors.primaryAccent} />
      ) : (
        <>
          {availableCategories.length > 0 && (
            <View style={styles.filterWrap}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                <Pressable
                  onPress={() => setSelectedCategoryId('all')}
                  style={[styles.filterChip, selectedCategoryId === 'all' && styles.filterChipSelected]}>
                  <Text
                    style={[styles.filterChipText, selectedCategoryId === 'all' && styles.filterChipTextSelected]}>
                    All
                  </Text>
                </Pressable>
                {availableCategories.map((category) => {
                  const isSelected = selectedCategoryId === category.id;
                  return (
                    <Pressable
                      key={category.id}
                      onPress={() => setSelectedCategoryId(category.id)}
                      style={[styles.filterChip, isSelected && styles.filterChipSelected]}>
                      <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>
                        {category.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          <SectionList
            sections={sections}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => <TransactionRow transaction={item} />}
            renderSectionHeader={({ section }) => <Text style={styles.sectionHeader}>{section.title}</Text>}
            stickySectionHeadersEnabled
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primaryAccent} />
            }
            ListEmptyComponent={<EmptyState hasAnyTransactions={transactions.length > 0} />}
          />
        </>
      )}
    </SafeAreaView>
  );
}

function TransactionRow({ transaction }: { transaction: Transaction }) {
  const { formatAmount } = useCurrency();
  const isIncome = transaction.type === 'income';
  const category = transaction.category;
  const badgeColor = category?.color ?? colors.primaryAccent;
  const categoryLabel = isIncome ? 'Income' : (category?.name ?? 'Uncategorized');
  const dateLabel = fromDateString(transaction.transaction_date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const amountColor = isIncome ? colors.chartSage : colors.secondaryAccent;
  const amountLabel = `${isIncome ? '+' : '-'}${formatAmount(transaction.amount)}`;

  return (
    <View style={styles.row}>
      <View style={[styles.iconBadge, { backgroundColor: withAlpha(badgeColor, '33') }]}>
        <Ionicons name={(category?.icon as any) ?? 'cash-outline'} size={18} color={badgeColor} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.merchant}>{transaction.merchant}</Text>
        <Text style={styles.categoryLabel}>
          {categoryLabel} · {dateLabel}
        </Text>
      </View>
      <Text style={[styles.amount, { color: amountColor }]}>{amountLabel}</Text>
    </View>
  );
}

function EmptyState({ hasAnyTransactions }: { hasAnyTransactions: boolean }) {
  if (hasAnyTransactions) {
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconBadge}>
          <Feather name="filter" size={22} color={colors.primaryAccent} />
        </View>
        <Text style={styles.emptyTitle}>No transactions here</Text>
        <Text style={styles.emptySubtitle}>Nothing in this category yet — try a different filter.</Text>
      </View>
    );
  }

  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconBadge}>
        <Feather name="inbox" size={22} color={colors.primaryAccent} />
      </View>
      <Text style={styles.emptyTitle}>Your money story starts here</Text>
      <Text style={styles.emptySubtitle}>Add your first transaction to get started.</Text>
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
    justifyContent: 'space-between',
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
    marginTop: Spacing.three,
    flexGrow: 1,
  },
  filterWrap: {
    marginTop: Spacing.three,
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
  sectionHeader: {
    backgroundColor: colors.background,
    color: colors.textMuted,
    fontSize: typography.sectionLabel.fontSize,
    fontWeight: typography.sectionLabel.fontWeight,
    textTransform: typography.sectionLabel.textTransform,
    letterSpacing: typography.sectionLabel.letterSpacing,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    padding: Spacing.three,
    marginBottom: Spacing.two,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  merchant: {
    color: colors.text,
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  categoryLabel: {
    color: colors.textMuted,
    fontSize: typography.caption.fontSize,
    marginTop: 2,
  },
  amount: {
    fontSize: typography.body.fontSize,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  emptyState: {
    flex: 1,
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
