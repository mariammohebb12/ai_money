import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ModalCloseButton } from '@/components/modal-close-button';
import { Spacing, colors, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useCurrency } from '@/hooks/use-currency';
import { advanceDueDate, repeatIntervalLabel, type RepeatInterval } from '@/lib/bill-recurrence';
import { describeDueDate, fromDateString, toDateString } from '@/lib/dates';
import { supabase } from '@/lib/supabase';

type Bill = {
  id: string | number;
  name: string;
  amount: number;
  due_date: string;
  is_paid: boolean;
  repeat_interval: RepeatInterval;
};

export default function BillsScreen() {
  const router = useRouter();
  const { session } = useAuth();

  const [bills, setBills] = useState<Bill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [billsCategoryId, setBillsCategoryId] = useState<string | number | null>(null);
  const [payingId, setPayingId] = useState<string | number | null>(null);

  // Marking a bill paid logs it as an expense in the existing "Bills" category,
  // so paid bills flow into spending totals and Analytics automatically.
  useEffect(() => {
    async function fetchBillsCategory() {
      const { data, error } = await supabase.from('categories').select('id').eq('name', 'Bills').single();
      if (error) {
        console.error('Failed to fetch Bills category:', error.message);
        return;
      }
      setBillsCategoryId(data.id);
    }
    fetchBillsCategory();
  }, []);

  const fetchBills = useCallback(async () => {
    if (!session) return;
    const { data, error } = await supabase
      .from('bills')
      .select('id, name, amount, due_date, is_paid, repeat_interval')
      .eq('user_id', session.user.id)
      .order('due_date', { ascending: true });
    if (error) {
      console.error('Failed to fetch bills:', error.message);
      setIsLoading(false);
      return;
    }
    setBills(data);
    setIsLoading(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      fetchBills();
    }, [fetchBills])
  );

  async function handleRefresh() {
    setIsRefreshing(true);
    await fetchBills();
    setIsRefreshing(false);
  }

  async function handleMarkPaid(bill: Bill) {
    if (!session || !billsCategoryId) return;
    setPayingId(bill.id);

    const { error: transactionError } = await supabase.from('transactions').insert({
      user_id: session.user.id,
      amount: bill.amount,
      type: 'expense',
      category_id: billsCategoryId,
      merchant: bill.name,
      transaction_date: toDateString(new Date()),
    });
    if (transactionError) {
      console.error('Failed to log bill payment as a transaction:', transactionError.message);
      setPayingId(null);
      return;
    }

    const { error: billError } = await supabase
      .from('bills')
      .update({ is_paid: true })
      .eq('id', bill.id)
      .eq('user_id', session.user.id);
    if (billError) {
      console.error('Failed to mark bill as paid:', billError.message);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    if (bill.repeat_interval !== 'none') {
      const nextDueDate = advanceDueDate(fromDateString(bill.due_date), bill.repeat_interval);
      const { error: nextBillError } = await supabase.from('bills').insert({
        user_id: session.user.id,
        name: bill.name,
        amount: bill.amount,
        due_date: toDateString(nextDueDate),
        is_paid: false,
        repeat_interval: bill.repeat_interval,
      });
      if (nextBillError) {
        console.error('Failed to create next recurring bill:', nextBillError.message);
      }
    }

    setPayingId(null);
    fetchBills();
  }

  const unpaidBills = bills.filter((bill) => !bill.is_paid);
  const paidBills = bills.filter((bill) => bill.is_paid);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <ModalCloseButton />
        <Text style={[styles.title, styles.titleFlex]}>Bills</Text>
        <Pressable style={styles.addButton} onPress={() => router.push('/add-bill')}>
          <Feather name="plus" size={20} color={colors.background} />
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.loading} color={colors.primaryAccent} />
      ) : bills.length === 0 ? (
        <ScrollView
          style={styles.emptyScrollFlex}
          contentContainerStyle={styles.emptyState}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primaryAccent} />
          }>
          <View style={styles.emptyIconBadge}>
            <Feather name="file-text" size={22} color={colors.primaryAccent} />
          </View>
          <Text style={styles.emptyTitle}>No bills yet</Text>
          <Text style={styles.emptySubtitle}>Add a bill to start tracking due dates.</Text>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primaryAccent} />
          }>
          <Text style={styles.sectionLabel}>Upcoming</Text>
          {unpaidBills.length === 0 ? (
            <Text style={styles.emptySubtitle}>Nothing due — you're all caught up.</Text>
          ) : (
            <View style={styles.rowGroup}>
              {unpaidBills.map((bill) => (
                <UnpaidBillRow
                  key={bill.id}
                  bill={bill}
                  isPaying={payingId === bill.id}
                  disabled={!billsCategoryId}
                  onMarkPaid={() => handleMarkPaid(bill)}
                />
              ))}
            </View>
          )}

          {paidBills.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, styles.paidSectionLabel]}>Paid</Text>
              <View style={styles.rowGroup}>
                {paidBills.map((bill) => (
                  <PaidBillRow key={bill.id} bill={bill} />
                ))}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function UnpaidBillRow({
  bill,
  isPaying,
  disabled,
  onMarkPaid,
}: {
  bill: Bill;
  isPaying: boolean;
  disabled: boolean;
  onMarkPaid: () => void;
}) {
  const { formatAmount } = useCurrency();
  const { label, isOverdue } = describeDueDate(fromDateString(bill.due_date));

  return (
    <View style={[styles.row, isOverdue && styles.rowOverdue]}>
      <View style={[styles.iconBadge, isOverdue && styles.iconBadgeOverdue]}>
        <Feather
          name={isOverdue ? 'alert-circle' : 'file-text'}
          size={18}
          color={isOverdue ? colors.secondaryAccent : colors.primaryAccent}
        />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.billName}>{bill.name}</Text>
        <Text style={[styles.billDue, isOverdue && styles.billDueOverdue]}>{label}</Text>
        {bill.repeat_interval !== 'none' && (
          <Text style={styles.billRepeat}>Repeats {repeatIntervalLabel(bill.repeat_interval).toLowerCase()}</Text>
        )}
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.billAmount}>{formatAmount(bill.amount)}</Text>
        <Pressable
          style={[styles.payButton, (isPaying || disabled) && styles.payButtonDisabled]}
          onPress={onMarkPaid}
          disabled={isPaying || disabled}>
          <Text style={styles.payButtonText}>{isPaying ? 'Saving…' : 'Mark paid'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function PaidBillRow({ bill }: { bill: Bill }) {
  const { formatAmount } = useCurrency();
  const dateLabel = fromDateString(bill.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <View style={styles.paidRow}>
      <Feather name="check-circle" size={16} color={colors.chartSage} />
      <Text style={styles.paidRowText}>
        {bill.name} · {dateLabel}
      </Text>
      <Text style={styles.paidRowAmount}>{formatAmount(bill.amount)}</Text>
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
    paddingBottom: Spacing.six,
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: typography.sectionLabel.fontSize,
    fontWeight: typography.sectionLabel.fontWeight,
    textTransform: typography.sectionLabel.textTransform,
    letterSpacing: typography.sectionLabel.letterSpacing,
  },
  paidSectionLabel: {
    marginTop: Spacing.five,
  },
  rowGroup: {
    marginTop: Spacing.three,
    gap: Spacing.two,
  },
  row: {
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
  rowOverdue: {
    borderWidth: 1.5,
    borderColor: colors.secondaryAccent,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryAccent + '1F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBadgeOverdue: {
    backgroundColor: colors.secondaryAccent + '26',
  },
  rowText: {
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
  billRepeat: {
    color: colors.chartDustyBlue,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: Spacing.one,
  },
  billAmount: {
    color: colors.text,
    fontSize: typography.body.fontSize,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  payButton: {
    backgroundColor: colors.primaryAccent,
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: Spacing.two,
  },
  payButtonDisabled: {
    opacity: 0.5,
  },
  payButtonText: {
    color: colors.background,
    fontSize: 12,
    fontWeight: '700',
  },
  paidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    opacity: 0.7,
  },
  paidRowText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
  },
  paidRowAmount: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
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
