import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { formatCurrency, getCurrencySymbol, type CurrencyCode } from '@/lib/currency';
import { supabase } from '@/lib/supabase';

type CurrencyContextValue = {
  currency: CurrencyCode;
  symbol: string;
  setCurrency: (value: CurrencyCode) => Promise<{ error: string | null }>;
  formatAmount: (amount: number) => string;
};

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: 'USD  symbol: getCurrencySymbol('USD'),
  setCurrency: async () => ({ error: null }),
  formatAmount: (amount) => formatCurrency(amount, 'USD'),
});

// Reads the user's chosen display currency once per session and shares it
// across every screen, so changing it in Profile updates amounts everywhere
// immediately instead of only after the app reloads.
export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [currency, setCurrencyState] = useState<CurrencyCode>('USD');

  useEffect(() => {
    async function fetchCurrency() {
      if (!session) {
        setCurrencyState('USD');
        return;
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('currency')
        .eq('id', session.user.id)
        .maybeSingle();
      if (error) {
        console.error('Failed to fetch currency:', error.message);
        return;
      }
      if (data) setCurrencyState(data.currency as CurrencyCode);
    }
    fetchCurrency();
  }, [session]);

  async function setCurrency(value: CurrencyCode) {
    const previous = currency;
    setCurrencyState(value);

    if (!session) return { error: 'You need to be logged in to save your profile.' };
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: session.user.id, currency: value, updated_at: new Date().toISOString() });
    if (error) {
      setCurrencyState(previous);
      return { error: error.message };
    }
    return { error: null };
  }

  function formatAmount(amount: number) {
    return formatCurrency(amount, currency);
  }

  return (
    <CurrencyContext.Provider value={{ currency, symbol: getCurrencySymbol(currency), setCurrency, formatAmount }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
