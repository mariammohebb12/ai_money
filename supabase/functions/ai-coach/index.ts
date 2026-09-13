// Supabase Edge Function: ai-coach
// Runs on Deno (not Node) — imports come from URLs, not npm.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const MAX_HISTORY_MESSAGES = 10;

function toDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  // Verify the caller is a logged-in user. supabase.functions.invoke() from the
  // app automatically attaches the user's session token in this header.
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401 });
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid or expired session' }), { status: 401 });
  }

  let message: string | undefined;
  let history: { role: 'user' | 'assistant'; content: string }[] = [];
  let isInsightMode = false;
  let focus = '';
  try {
    const body = await req.json();
    message = body.message;
    isInsightMode = body.mode === 'insight';
    focus = typeof body.focus === 'string' ? body.focus : '';
    if (Array.isArray(body.history)) {
      history = body.history.slice(-MAX_HISTORY_MESSAGES);
    }
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }

  if (!isInsightMode && (!message || typeof message !== 'string')) {
    return new Response(JSON.stringify({ error: 'Missing "message" string in request body' }), { status: 400 });
  }

  // RLS scopes every one of these queries to the caller's own rows, since the
  // client above carries the user's own auth token, not a service role key.
  // 8 weeks (not 30 days): comparisons/trends need this period vs an earlier
  // one to compare against, so the window has to cover more than one period.
  const eightWeeksAgo = new Date();
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

  const [transactionsResult, goalsResult, billsResult, profileResult] = await Promise.all([
    supabase
      .from('transactions')
      .select('amount, type, merchant, transaction_date, category:categories(name)')
      .eq('user_id', user.id)
      .gte('transaction_date', toDateString(eightWeeksAgo))
      .order('transaction_date', { ascending: false }),
    supabase.from('saving_goals').select('name, target_amount, current_amount, target_date').eq('user_id', user.id),
    supabase
      .from('bills')
      .select('name, amount, due_date')
      .eq('user_id', user.id)
      .eq('is_paid', false)
      .order('due_date', { ascending: true }),
    supabase.from('profiles').select('currency').eq('id', user.id).maybeSingle(),
  ]);

  // Display currency only — the numbers below are never converted, just
  // labeled/formatted differently depending on what the user picked in Profile.
  const currency = profileResult.data?.currency ?? 'USD';

  const financialContext = {
    recent_transactions_last_8_weeks: (transactionsResult.data ?? []).map((t) => ({
      amount: t.amount,
      type: t.type,
      merchant: t.merchant,
      category: (t.category as { name: string } | null)?.name ?? null,
      date: t.transaction_date,
    })),
    savings_goals: goalsResult.data ?? [],
    upcoming_unpaid_bills: billsResult.data ?? [],
  };

  const currencyInstruction = `All amounts below are in ${currency}. When you mention an amount, format it
using ${currency}'s standard symbol or code (e.g. $ for USD, € for EUR, £ for GBP, E£ for EGP) — never
default to $ unless the currency is actually USD. This is a display label only, not a currency conversion:
the numbers themselves are exactly as given, just note them in ${currency}.`;

  const systemPrompt = isInsightMode
    ? `You are a financial insight generator inside a personal finance app.
Below is the user's real financial data as JSON, covering the last 8 weeks. Respond with EXACTLY ONE
short, specific, natural-sounding sentence, focused on ${focus || 'their recent activity'}.

${currencyInstruction}

The user's screen already shows their total spent, income, savings rate, and a per-category breakdown —
so a genuinely useful insight must NOT just restate one of those numbers (e.g. never just "You spent X
on Y" or "Your savings rate is X%"). Instead, look for something they would NOT immediately notice
themselves, in this priority order:

1. A COMPARISON or TREND — this period/category vs. their average, vs. an earlier period in the 8 weeks,
   or vs. another category, using only the 8 weeks of data given (e.g. "Your Food spending is 40% higher
   than your daily average" or "You're spending noticeably more this week than you were a month ago").
2. A PATTERN or ANOMALY — a recurring behavior or something unusual in the dates/categories/merchants
   (e.g. "You've spent money on Shopping 3 days in a row" or "Most of your spending happens on weekends").
3. Something ACTIONABLE or FORWARD-LOOKING — a projection grounded strictly in the given 8 weeks, never
   referencing a period outside this data (e.g. "At this pace, you'll spend 200 more than the first half
   of this period by the end of it").

Only use real numbers, merchants, categories, bill, or goal names from the data below — never invent one.
If, after genuinely checking all three, none of them holds up for this data, say so plainly instead of
forcing a weak insight — e.g. "Not enough history yet to spot a clear trend." No greeting, no follow-up
question, no preamble — just the one sentence. Never mention that you were given JSON.

${JSON.stringify(financialContext)}`
    : `You are a helpful, concise financial coach inside a personal finance app.
Below is the user's real financial data as of right now, as JSON. Use it naturally to answer their
questions and reference specific numbers, merchants, categories, or bill/goal names where relevant.
Never mention that you were given JSON or refer to it as "the data" — just speak as if you know their finances.
If the data doesn't cover what they're asking, say so honestly instead of guessing.

${currencyInstruction}

${JSON.stringify(financialContext)}`;

  const openaiMessages = isInsightMode
    ? [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Give me one short insight about my finances right now.' },
      ]
    : [
        { role: 'system', content: systemPrompt },
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: message },
      ];

  const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: openaiMessages,
      max_tokens: isInsightMode ? 60 : undefined,
    }),
  });

  if (!openaiResponse.ok) {
    const errorText = await openaiResponse.text();
    console.error('OpenAI request failed:', errorText);
    return new Response(JSON.stringify({ error: 'AI Coach is unavailable right now' }), { status: 502 });
  }

  const openaiData = await openaiResponse.json();
  const reply = openaiData.choices?.[0]?.message?.content ?? '';

  return new Response(JSON.stringify({ reply }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
