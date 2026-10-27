export interface ExpenseItem {
  merchant: string;
  date: string;
  amount: string;
  description: string;
  descriptionText?: string;
  need: boolean;
  status: 'Scheduled' | 'Pending' | 'Upcoming' | 'Paid';
  source?: 'statement' | 'paycheck' | 'balance' | 'recurring' | 'transfer-in' | 'transfer-out';
  /** Statement transfer store key, so a displayed transfer can be removed. */
  transferKey?: string;
  sourceFile?: string;
  recurringMonthly?: boolean;
  /** Set when someone chooses a description, so later category rules leave it alone. */
  descriptionManual?: boolean;
}

export const SEED_EXPENSES: ExpenseItem[] = [
  {
    merchant: 'Amazon',
    date: '2025-02-01',
    amount: '$50.00',
    description: 'Books',
    need: false,
    status: 'Paid',
  },
  {
    merchant: 'Walmart',
    date: '2025-02-05',
    amount: '$30.00',
    description: 'Groceries',
    need: true,
    status: 'Scheduled',
  },
  {
    merchant: 'Netflix',
    date: '2025-02-10',
    amount: '$15.00',
    description: 'Subscription',
    need: true,
    status: 'Pending',
  },
  {
    merchant: 'Electric Company',
    date: '2025-02-15',
    amount: '$100.00',
    description: 'Utilities',
    need: true,
    status: 'Upcoming',
  },
];

const SEED_SIGNATURE = SEED_EXPENSES.map(seedSignature).sort().join('||');

export function parseMoney(amount: string | number): number {
  if (typeof amount === 'number') return Number.isFinite(amount) ? amount : 0;
  const value = parseFloat(String(amount).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(value) ? value : 0;
}

export function formatMoney(amount: number): string {
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function expensesKey(username: string): string {
  return `expenses_${username.trim().toLowerCase()}`;
}

function transfersKey(username: string): string {
  return `statement_transfers_${username.trim().toLowerCase()}`;
}

export function parseDate(dateStr: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Date(dateStr);
}

export function loadExpenses(username: string): ExpenseItem[] {
  const raw = localStorage.getItem(expensesKey(username));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function isSeedExpenses(items: ExpenseItem[]): boolean {
  if (items.length !== SEED_EXPENSES.length) return false;
  return items.map(seedSignature).sort().join('||') === SEED_SIGNATURE;
}

export function sumByCategory(items: Pick<ExpenseItem, 'description' | 'amount'>[]): Record<string, number> {
  const totals: Record<string, number> = {};
  items.forEach(item => {
    const category = item.description.toLowerCase();
    totals[category] = (totals[category] || 0) + parseMoney(item.amount);
  });
  return totals;
}

export function categoryLabel(category: string): string {
  const normalized = category.toLowerCase();
  if (normalized === 'ez pass') return 'EZ Pass';
  if (normalized === 'other') return 'everything else';
  if (normalized === 'monster energy drink') return 'Monster energy drink';
  return category;
}

const DESCRIPTION_COLORS: Record<string, { badge: string; hex: string }> = {
  bills: { badge: 'bg-rose-100 text-rose-900', hex: '#e11d48' },
  subscriptions: { badge: 'bg-violet-100 text-violet-900', hex: '#6d28d9' },
  subscription: { badge: 'bg-violet-100 text-violet-900', hex: '#6d28d9' },
  gas: { badge: 'bg-amber-100 text-amber-900', hex: '#d97706' },
  'ez pass': { badge: 'bg-sky-100 text-sky-900', hex: '#0369a1' },
  lunch: { badge: 'bg-orange-100 text-orange-900', hex: '#ea580c' },
  breakfast: { badge: 'bg-yellow-100 text-yellow-900', hex: '#ca8a04' },
  'monster energy drink': { badge: 'bg-lime-100 text-lime-900', hex: '#4d7c0f' },
  'eating out': { badge: 'bg-pink-100 text-pink-900', hex: '#db2777' },
  bar: { badge: 'bg-purple-100 text-purple-900', hex: '#7e22ce' },
  groceries: { badge: 'bg-emerald-100 text-emerald-900', hex: '#047857' },
  utilities: { badge: 'bg-cyan-100 text-cyan-900', hex: '#0e7490' },
  transportation: { badge: 'bg-blue-100 text-blue-900', hex: '#1d4ed8' },
  insurance: { badge: 'bg-indigo-100 text-indigo-900', hex: '#4338ca' },
  entertainment: { badge: 'bg-fuchsia-100 text-fuchsia-900', hex: '#a21caf' },
  books: { badge: 'bg-stone-100 text-stone-800', hex: '#57534e' },
  paycheck: { badge: 'bg-green-100 text-green-900', hex: '#15803d' },
  'transfer in': { badge: 'bg-green-100 text-green-900', hex: '#15803d' },
  'transfer out': { badge: 'bg-rose-100 text-rose-900', hex: '#e11d48' },
  'account balance': { badge: 'bg-blue-200 text-blue-950', hex: '#1e3a8a' },
  other: { badge: 'bg-gray-100 text-gray-800', hex: '#4b5563' },
};

const DESCRIPTION_COLOR_FALLBACK = [
  { badge: 'bg-teal-100 text-teal-900', hex: '#0f766e' },
  { badge: 'bg-red-100 text-red-900', hex: '#b91c1c' },
  { badge: 'bg-slate-100 text-slate-800', hex: '#475569' },
  { badge: 'bg-orange-200 text-orange-950', hex: '#9a3412' },
  { badge: 'bg-lime-200 text-lime-950', hex: '#3f6212' },
  { badge: 'bg-indigo-200 text-indigo-950', hex: '#312e81' },
];

export function descriptionStyle(description: string): { badge: string; hex: string } {
  const key = description.trim().toLowerCase();
  const known = DESCRIPTION_COLORS[key];
  if (known) return known;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash += key.charCodeAt(i) * (i + 1);
  return DESCRIPTION_COLOR_FALLBACK[Math.abs(hash) % DESCRIPTION_COLOR_FALLBACK.length];
}

/** Fallback date when no paycheck schedule is saved. */
export const PAYCHECK_ANCHOR = '2026-08-26';

export interface PaycheckSettings {
  amount: number;
  intervalDays: number;
  anchor: string;
  extraDates?: string[];
}

function paycheckSettingsKey(username: string): string {
  return `paycheck_settings_${username.trim().toLowerCase()}`;
}

export function loadPaycheckSettings(username: string): PaycheckSettings | null {
  const raw = localStorage.getItem(paycheckSettingsKey(username));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PaycheckSettings>;
    if (typeof parsed.amount !== 'number' || typeof parsed.intervalDays !== 'number' || typeof parsed.anchor !== 'string') {
      return null;
    }
    if (parsed.amount <= 0 || parsed.intervalDays < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.anchor)) return null;
    const extraDates = Array.isArray(parsed.extraDates)
      ? parsed.extraDates.filter((date): date is string => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date))
      : [];
    return {
      amount: parsed.amount,
      intervalDays: Math.round(parsed.intervalDays),
      anchor: parsed.anchor,
      extraDates,
    };
  } catch {
    return null;
  }
}

export function savePaycheckSettings(username: string, settings: PaycheckSettings): void {
  localStorage.setItem(paycheckSettingsKey(username), JSON.stringify(settings));
}

export function resolvePaycheckSettings(username: string): PaycheckSettings | null {
  return loadPaycheckSettings(username);
}

const SAVINGS_CATEGORIES = ['eating out', 'bar', 'monster energy drink', 'subscriptions', 'gas', 'ez pass', 'lunch'];

export interface BalanceSnapshot {
  date: string;
  amount: number;
}

export interface BalanceEstimate {
  paycheckAmount: number;
  paycheckCount: number;
  paycheckDates: string[];
  upcomingDates: string[];
  nextPaycheck: string | null;
  income: number;
  spent: number;
  savingsSetAside: number;
  remaining: number;
  snapshotDate: string | null;
  snapshotAmount: number | null;
}

function balanceKey(username: string): string {
  return `balance_snapshots_${username.trim().toLowerCase()}`;
}

export function loadBalanceSnapshots(username: string): BalanceSnapshot[] {
  const raw = localStorage.getItem(balanceKey(username));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is BalanceSnapshot => (
        !!item
        && typeof item.date === 'string'
        && /^\d{4}-\d{2}-\d{2}$/.test(item.date)
        && typeof item.amount === 'number'
        && Number.isFinite(item.amount)
      ))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}

export function saveBalanceSnapshot(username: string, date: string, amount: number): BalanceSnapshot[] | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(amount)) return null;
  const next = loadBalanceSnapshots(username).filter(item => item.date !== date);
  next.push({ date, amount });
  next.sort((a, b) => a.date.localeCompare(b.date));
  localStorage.setItem(balanceKey(username), JSON.stringify(next));
  return next;
}

export function removeBalanceSnapshot(username: string, date: string): BalanceSnapshot[] {
  const next = loadBalanceSnapshots(username).filter(item => item.date !== date);
  localStorage.setItem(balanceKey(username), JSON.stringify(next));
  return next;
}

/** Latest recorded balance on or before the end of the period being estimated. */
export function latestBalanceSnapshot(snapshots: BalanceSnapshot[], end: string): BalanceSnapshot | null {
  return snapshots
    .filter(item => item.date <= end)
    .sort((a, b) => b.date.localeCompare(a.date))[0] || null;
}

export function todayISO(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, month - 1, day + days);
  return todayISO(date);
}

function displayDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${month}/${day}/${year}`;
}

function monthName(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  if (!year || !month) return monthKey;
  return new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

export function monthRange(monthKey: string): { start: string; end: string } {
  const [year, month] = monthKey.split('-').map(Number);
  const last = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, '0');
  return { start: `${year}-${mm}-01`, end: `${year}-${mm}-${String(last).padStart(2, '0')}` };
}

/** From the first expense through today, so later paychecks are part of the full picture. */
export function periodThroughToday(
  items: Pick<ExpenseItem, 'date'>[],
  now = new Date(),
  anchor = PAYCHECK_ANCHOR,
  extraDates: string[] = []
): { start: string; end: string } {
  const dates = [...items.map(item => item.date), ...extraDates].filter(Boolean).sort();
  const start = dates.length && dates[0] < anchor ? dates[0] : anchor;
  return { start, end: todayISO(now) };
}

function intervalLabel(days: number): string {
  if (days === 7) return 'every week';
  if (days === 14) return 'every 2 weeks';
  if (days === 30) return 'every 30 days';
  return `every ${days} days`;
}

/** The next calendar month, such as November when today is in October. */
export function upcomingMonthKey(now = new Date()): string {
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

/** Upcoming paychecks outside the next calendar month stay off the schedule list. */
export function includeInSchedule(item: Pick<ExpenseItem, 'source' | 'status' | 'date'>, now = new Date()): boolean {
  if (item.source === 'paycheck' && item.status === 'Upcoming') {
    return item.date.slice(0, 7) === upcomingMonthKey(now);
  }
  return true;
}

export function buildPaychecks(now = new Date(), settings: PaycheckSettings | null = null): ExpenseItem[] {
  if (!settings || settings.amount <= 0 || settings.intervalDays < 1) return [];
  const today = todayISO(now);
  const interval = Math.round(settings.intervalDays);
  let end = monthRange(upcomingMonthKey(now)).end;
  if (settings.anchor > end) end = settings.anchor;
  const dates: string[] = [];
  let steps = 0;
  for (let date = settings.anchor; date <= end && steps < 520; date = addDays(date, interval), steps += 1) {
    dates.push(date);
  }
  const generated = new Set(dates);
  const extras = (settings.extraDates || []).filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date));
  const allDates = Array.from(new Set([...dates, ...extras])).sort();
  return allDates.map(date => ({
    merchant: 'Paycheck',
    date,
    amount: formatMoney(settings.amount),
    description: 'paycheck',
    descriptionText: generated.has(date) ? `Paycheck ${intervalLabel(interval)}` : 'Paycheck added',
    need: true,
    status: date <= today ? 'Paid' : 'Upcoming',
    source: 'paycheck',
  }));
}

export function addRetroactivePaycheck(
  username: string,
  date: string
): { settings: PaycheckSettings | null; already: boolean; added: boolean } {
  const current = resolvePaycheckSettings(username);
  if (!current || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { settings: current, already: false, added: false };
  const scheduled = new Set(buildPaychecks(new Date(), { ...current, extraDates: [] }).map(item => item.date));
  const extras = current.extraDates || [];
  if (scheduled.has(date) || extras.includes(date)) return { settings: current, already: true, added: false };
  const next = { ...current, extraDates: [...extras, date].sort() };
  savePaycheckSettings(username, next);
  return { settings: next, already: false, added: true };
}

export function removeRetroactivePaycheck(username: string, date: string): PaycheckSettings | null {
  const current = resolvePaycheckSettings(username);
  if (!current) return null;
  const next = { ...current, extraDates: (current.extraDates || []).filter(item => item !== date) };
  savePaycheckSettings(username, next);
  return next;
}

export function estimateBalance(
  items: ExpenseItem[],
  savingsSetAside = 0,
  range?: { start: string; end: string },
  now = new Date(),
  settings: PaycheckSettings | null = null,
  snapshot: BalanceSnapshot | null = null,
  transferredIn = 0
): BalanceEstimate {
  const expenses = items.filter(item => item.source !== 'paycheck' && item.source !== 'balance' && item.source !== 'recurring' && item.source !== 'transfer-in' && item.source !== 'transfer-out');
  const today = todayISO(now);
  const anchor = settings?.anchor || PAYCHECK_ANCHOR;
  const start = range?.start ?? (expenses.map(item => item.date).sort()[0] || anchor);
  const end = range?.end ?? today;
  const reset = snapshot && snapshot.date <= end ? snapshot : null;
  const counts = (date: string) => (reset ? date > reset.date && date <= end : date >= start && date <= end);
  const spent = expenses.reduce((sum, item) => sum + (counts(item.date) ? Math.abs(parseMoney(item.amount)) : 0), 0);
  const scheduled = buildPaychecks(now, settings).filter(item => counts(item.date));
  const received = scheduled.filter(item => item.date <= today);
  const upcoming = scheduled.filter(item => item.date > today);
  const amount = settings?.amount || 0;
  const income = received.length * amount;
  const nextPaycheck = buildPaychecks(now, settings).find(item => item.status === 'Upcoming')?.date ?? null;
  const opening = reset ? reset.amount : 0;
  return {
    paycheckAmount: amount,
    paycheckCount: received.length,
    paycheckDates: received.map(item => item.date),
    upcomingDates: upcoming.map(item => item.date),
    nextPaycheck,
    income,
    spent,
    savingsSetAside,
    remaining: (reset ? opening : 0) + income + transferredIn - spent - savingsSetAside,
    snapshotDate: reset?.date ?? null,
    snapshotAmount: reset?.amount ?? null,
  };
}

export interface DatedTransfer {
  date: string;
  amount: number;
  direction: 'in' | 'out';
  key: string;
  text: string;
}

/** Running estimated balance after each row. A recorded balance replaces the running amount. Later paychecks add to it. Payments, bills, and savings transfers subtract. */
export function estimatedRemainingByKey(
  rows: Array<{ key: string; item: Pick<ExpenseItem, 'date' | 'amount' | 'source'> }>,
  transfers: DatedTransfer[] = []
): Map<string, number> {
  const rank = { snapshot: 0, transfer: 1, in: 2, out: 3 };
  const events: Array<{ date: string; kind: keyof typeof rank; amount: number; key?: string }> = [];
  rows.forEach(row => {
    const source = row.item.source;
    const amount = parseMoney(row.item.amount);
    events.push({
      date: row.item.date,
      kind: source === 'balance' ? 'snapshot' : source === 'paycheck' || source === 'transfer-in' ? 'in' : 'out',
      amount: source === 'balance' ? amount : Math.abs(amount),
      key: row.key,
    });
  });
  transfers.forEach(transfer => {
    events.push({
      date: transfer.date,
      kind: transfer.direction === 'in' ? 'in' : 'transfer',
      amount: Math.abs(transfer.amount),
    });
  });
  events.sort((a, b) => a.date.localeCompare(b.date) || rank[a.kind] - rank[b.kind]);

  let remaining = 0;
  let snapshotDate: string | null = null;
  const balances = new Map<string, number>();
  events.forEach(event => {
    const coveredBySnapshot = snapshotDate !== null && event.date <= snapshotDate && event.kind !== 'snapshot';
    if (event.kind === 'snapshot') {
      remaining = event.amount;
      snapshotDate = event.date;
    } else if (!coveredBySnapshot) {
      remaining += event.kind === 'in' ? event.amount : -event.amount;
    }
    if (event.key) balances.set(event.key, remaining);
  });
  return balances;
}

export function savingsSuggestion(
  items: ExpenseItem[],
  savingsSetAside = 0,
  range?: { start: string; end: string },
  settings: PaycheckSettings | null = null,
  snapshot: BalanceSnapshot | null = null,
  transferredIn = 0
): string {
  const balance = estimateBalance(items, savingsSetAside, range, new Date(), settings, snapshot, transferredIn);
  const totals = sumByCategory(items.filter(item => item.source !== 'paycheck' && item.source !== 'balance' && item.source !== 'recurring' && item.source !== 'transfer-in' && item.source !== 'transfer-out'));
  const cut = SAVINGS_CATEGORIES
    .map(key => ({ key, amount: totals[key] || 0 }))
    .filter(item => item.amount > 0)
    .sort((a, b) => b.amount - a.amount)[0];
  const dates = balance.paycheckDates.map(displayDate);
  const dateList = dates.length ? ` (${dates.join(', ')})` : '';
  const upcoming = balance.upcomingDates.map(displayDate);
  const sinceReset = balance.snapshotDate ? ` since ${displayDate(balance.snapshotDate)}` : '';
  const checks =
    balance.paycheckCount === 0 && upcoming.length
      ? `The ${upcoming.join(', ')} paycheck is on the schedule and has not arrived yet`
      : balance.paycheckCount === 0
        ? settings
          ? balance.snapshotDate
            ? `No paycheck has arrived since the recorded balance`
            : `No paycheck on the ${displayDate(settings.anchor)} schedule (${intervalLabel(settings.intervalDays)}) falls in this period`
          : 'No paycheck amount or interval is set'
        : balance.paycheckCount === 1
          ? `1 paycheck of ${formatMoney(balance.paycheckAmount)}${dateList} brings in ${formatMoney(balance.income)}${sinceReset}`
          : `${balance.paycheckCount} paychecks of ${formatMoney(balance.paycheckAmount)} ${settings ? intervalLabel(settings.intervalDays) : 'on this schedule'}${dateList} bring in ${formatMoney(balance.income)}${sinceReset}`;
  const movedIn = transferredIn > 0 ? `, plus ${formatMoney(transferredIn)} transferred in` : '';
  const setAside =
    savingsSetAside > 0 ? ` and ${formatMoney(savingsSetAside)} already moved to savings` : '';
  let advice = '';
  if (cut && balance.remaining < balance.income * 0.1) {
    const label = categoryLabel(cut.key);
    const named = label.charAt(0).toUpperCase() + label.slice(1);
    const after = balance.remaining + cut.amount;
    advice = after < 0
      ? ` ${named} is ${formatMoney(cut.amount)}. Cutting that category would still leave the balance short by ${formatMoney(Math.abs(after))}.`
      : ` ${named} is ${formatMoney(cut.amount)}. Cutting that category would leave about ${formatMoney(after)}.`;
  } else if (balance.remaining > 0) {
    advice = savingsSetAside > 0
      ? ` Setting aside part of the ${formatMoney(balance.remaining)} that remains would grow savings past the transfers already made.`
      : ` Setting aside part of the ${formatMoney(balance.remaining)} that remains would build savings.`;
  }
  const showNext = !range || range.end >= todayISO();
  const next = showNext && balance.nextPaycheck && !balance.upcomingDates.includes(balance.nextPaycheck)
    ? ` Next paycheck is ${displayDate(balance.nextPaycheck)}.`
    : '';
  const opening = balance.snapshotDate
    ? `A recorded balance of ${formatMoney(balance.snapshotAmount || 0)} on ${displayDate(balance.snapshotDate)} resets what is available. `
    : '';
  const spentWhen = balance.snapshotDate ? ` since ${displayDate(balance.snapshotDate)}` : '';
  return `${opening}${checks}. After ${formatMoney(balance.spent)} in spending${spentWhen}${movedIn}${setAside}, estimated remaining balance is ${formatMoney(balance.remaining)}.${advice}${next}`;
}

/** Same rule the expense tracker uses: the largest category over $100. */
export function primaryAiSuggestion(totals: Record<string, number>): string | null {
  const largest = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
  if (!largest || largest[1] <= 100) return null;
  return `You spent ${formatMoney(largest[1])} on ${categoryLabel(largest[0])}. Consider reducing this category to save money!`;
}

export interface UpcomingBill {
  merchant: string;
  amount: number;
  date: string;
}

function occurrenceOnDay(year: number, month: number, day: number): string {
  const last = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(day, last)).padStart(2, '0')}`;
}

function recurringTemplates(items: ExpenseItem[]): ExpenseItem[] {
  const templates = new Map<string, ExpenseItem>();
  items.forEach(item => {
    if (!item.recurringMonthly || item.source === 'paycheck' || item.source === 'balance' || item.source === 'recurring' || item.source === 'transfer-in' || item.source === 'transfer-out') return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date)) return;
    const key = `${item.merchant.trim().toLowerCase()}|${parseMoney(item.amount).toFixed(2)}|${item.date.slice(8, 10)}`;
    const prev = templates.get(key);
    if (!prev || item.date > prev.date) templates.set(key, item);
  });
  return Array.from(templates.values());
}

function recordedThisMonth(items: ExpenseItem[], template: ExpenseItem, month: string): boolean {
  const merchant = template.merchant.trim().toLowerCase();
  const amount = parseMoney(template.amount);
  return items.some(item => (
    item.source !== 'paycheck'
    && item.source !== 'balance'
    && item.source !== 'recurring'
    && item.merchant.trim().toLowerCase() === merchant
    && Math.abs(parseMoney(item.amount) - amount) < 0.009
    && item.date.slice(0, 7) === month
  ));
}

/** Upcoming rows for recurring bills in the next calendar month that are not recorded yet. */
export function projectedRecurringRows(items: ExpenseItem[], now = new Date()): ExpenseItem[] {
  const today = todayISO(now);
  const monthKey = upcomingMonthKey(now);
  const [year, month] = monthKey.split('-').map(Number);
  const rows: ExpenseItem[] = [];
  recurringTemplates(items).forEach(template => {
    const day = Number(template.date.slice(8, 10));
    const date = occurrenceOnDay(year, month, day);
    if (date < today) return;
    if (recordedThisMonth(items, template, monthKey)) return;
    rows.push({
      merchant: template.merchant,
      date,
      amount: template.amount,
      description: template.description,
      descriptionText: template.descriptionText,
      need: template.need,
      status: 'Upcoming',
      source: 'recurring',
      recurringMonthly: true,
    });
  });
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.merchant.localeCompare(b.merchant));
}

function recurringMatch(item: ExpenseItem, source: Pick<ExpenseItem, 'merchant' | 'amount' | 'date'>): boolean {
  if (!item.recurringMonthly) return false;
  if (item.source === 'paycheck' || item.source === 'balance' || item.source === 'recurring') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date) || !/^\d{4}-\d{2}-\d{2}$/.test(source.date)) return false;
  return item.merchant.trim().toLowerCase() === source.merchant.trim().toLowerCase()
    && Math.abs(parseMoney(item.amount) - parseMoney(source.amount)) < 0.009
    && item.date.slice(8, 10) === source.date.slice(8, 10);
}

function latestRecurringIndex(items: ExpenseItem[], source: Pick<ExpenseItem, 'merchant' | 'amount' | 'date'>): number {
  let found = -1;
  items.forEach((item, index) => {
    if (!recurringMatch(item, source)) return;
    if (found < 0 || item.date > items[found].date) found = index;
  });
  return found;
}

/** Writes an edit of a projected row back onto the bill that generates it. */
export function updateRecurringTemplate(items: ExpenseItem[], source: ExpenseItem, next: ExpenseItem): ExpenseItem[] {
  const index = latestRecurringIndex(items, source);
  if (index < 0) return items;
  const day = Number(String(next.date).slice(8, 10));
  return items.map((item, itemIndex) => {
    if (!recurringMatch(item, source)) return item;
    if (itemIndex !== index) return { ...item, recurringMonthly: false };
    const [year, month] = item.date.split('-').map(Number);
    return {
      ...item,
      merchant: next.merchant.trim() || item.merchant,
      date: Number.isFinite(day) && day > 0 ? occurrenceOnDay(year, month, day) : item.date,
      amount: next.amount,
      description: next.description,
      need: next.need,
      status: item.status,
      recurringMonthly: !!next.recurringMonthly,
      descriptionManual: true,
    };
  });
}

export function clearRecurringTemplate(items: ExpenseItem[], source: ExpenseItem): ExpenseItem[] {
  return items.map(item => (recurringMatch(item, source) ? { ...item, recurringMonthly: false } : item));
}

export function upcomingBills(items: ExpenseItem[], now = new Date()): UpcomingBill[] {
  const seen = new Set<string>();
  const bills: UpcomingBill[] = [];
  projectedRecurringRows(items, now).forEach(item => {
    const key = `${item.merchant.trim().toLowerCase()}|${parseMoney(item.amount).toFixed(2)}`;
    if (seen.has(key)) return;
    seen.add(key);
    bills.push({ merchant: item.merchant, amount: parseMoney(item.amount), date: item.date });
  });
  return bills;
}

export function upcomingSuggestions(
  items: ExpenseItem[],
  settings: PaycheckSettings | null,
  now = new Date(),
  prompts?: { promptPaycheck?: boolean; promptMonthly?: boolean }
): string[] {
  const messages: string[] = [];
  const monthKey = upcomingMonthKey(now);
  const range = monthRange(monthKey);
  const bills = upcomingBills(items, now).filter(bill => bill.date >= range.start && bill.date <= range.end);
  if (bills.length) {
    const total = bills.reduce((sum, bill) => sum + bill.amount, 0);
    const named = bills
      .slice(0, 6)
      .map(bill => `${bill.merchant} ${formatMoney(bill.amount)} on ${displayDate(bill.date)}`)
      .join('; ');
    messages.push(`Upcoming monthly bills for ${monthName(monthKey)}: ${named}. That is ${formatMoney(total)} coming due.`);
  } else if (prompts?.promptMonthly && items.some(item => item.source === 'statement')) {
    messages.push('Mark the bills that repeat each month to see when they come due.');
  }

  const checks = settings
    ? buildPaychecks(now, settings).filter(item => item.date >= range.start && item.date <= range.end)
    : [];
  if (settings && checks.length) {
    const dates = checks.map(item => displayDate(item.date)).join(' and ');
    const paycheckTotal = settings.amount * checks.length;
    let text = checks.length === 1
      ? `Upcoming paycheck in ${monthName(monthKey)}: ${formatMoney(settings.amount)} on ${dates}.`
      : `Upcoming paychecks in ${monthName(monthKey)}: ${formatMoney(settings.amount)} on ${dates}, ${formatMoney(paycheckTotal)} together.`;
    if (bills.length) {
      const total = bills.reduce((sum, bill) => sum + bill.amount, 0);
      const left = paycheckTotal - total;
      text += left >= 0
        ? ` Those paychecks cover those bills with ${formatMoney(left)} left.`
        : ` Those bills are ${formatMoney(Math.abs(left))} more than those paychecks.`;
    }
    messages.push(text);
  } else if (!settings && prompts?.promptPaycheck) {
    messages.push('Set a paycheck amount and how often it arrives to see the next paycheck.');
  }
  return messages;
}

export function buildAiSuggestions(
  items: ExpenseItem[],
  savingsSetAside = 0,
  settings: PaycheckSettings | null = null,
  prompts?: { promptPaycheck?: boolean; promptMonthly?: boolean },
  snapshot: BalanceSnapshot | null = null,
  transferredIn = 0
): string[] {
  const spendingItems = items.filter(item => item.source !== 'transfer-in' && item.source !== 'transfer-out');
  const expenses = spendingItems.filter(item => item.source === 'statement' || spendingItems.every(row => row.source !== 'statement'));
  const totals = sumByCategory(expenses);
  const messages: string[] = [];
  const primary = primaryAiSuggestion(totals);
  if (primary) messages.push(primary);

  const merchants = (category: string) => uniqueMerchants(expenses, category);
  const amountOf = (category: string) => totals[category] || 0;

  const opportunities = [
    {
      key: 'subscriptions',
      amount: amountOf('subscriptions'),
      text: subscriptionSuggestion(amountOf('subscriptions'), merchants('subscriptions')),
    },
    {
      key: 'gas',
      amount: amountOf('gas'),
      text: `You spent ${formatMoney(amountOf('gas'))} on gas. Combining trips could lower this category to save money.`,
    },
    {
      key: 'ez pass',
      amount: amountOf('ez pass'),
      text: `You spent ${formatMoney(amountOf('ez pass'))} on EZ Pass. Grouping trips or a commuter plan could lower this category to save money.`,
    },
  ]
    .filter(item => item.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  opportunities.forEach(item => {
    if (!messages.includes(item.text)) messages.push(item.text);
  });

  const billAmount = amountOf('bills');
  if (billAmount > 100) {
    const topBill = topMerchant(expenses, 'bills');
    if (topBill) {
      const plan = /apartment|rent/i.test(topBill.merchant)
        ? ''
        : ' Compare that bill where a lower plan is available.';
      messages.push(
        `You spent ${formatMoney(billAmount)} on bills. The largest is ${topBill.merchant} at ${formatMoney(topBill.amount)}.${plan}`
      );
    }
  }

  const period = periodThroughToday(expenses, new Date(), settings?.anchor, settings?.extraDates);
  const balanceItems = snapshot ? expenses.filter(item => item.date > snapshot.date) : expenses;
  messages.push(savingsSuggestion(
    balanceItems,
    savingsSetAside,
    snapshot ? { start: snapshot.date, end: period.end } : period,
    settings,
    snapshot,
    transferredIn
  ));

  return [...upcomingSuggestions(expenses, settings, new Date(), prompts), ...messages];
}

interface StoredTransfer {
  key: string;
  amount: number;
  direction?: 'in' | 'out';
}

/** Account-to-account movement. "Transfer from" brings money in. "Transfer to" and Save As You Go take money out. */
function transferDirection(text: string, direction: 'in' | 'out'): 'in' | 'out' | null {
  const normalized = text.toLowerCase();
  const incoming = /online transfer from|transfer from|from way2save/.test(normalized);
  const outgoing = /save as you go|transfer debit to|online transfer to|transfer to|to way2save/.test(normalized);
  if (incoming && !outgoing) return 'in';
  if (outgoing && !incoming) return 'out';
  if (/way2save/.test(normalized)) return direction;
  return null;
}

function storedTransferDirection(transfer: StoredTransfer): 'in' | 'out' {
  if (transfer.direction === 'in' || transfer.direction === 'out') return transfer.direction;
  const text = transfer.key.split('|').slice(2).join('|');
  return transferDirection(text, 'out') === 'in' ? 'in' : 'out';
}

export function loadDatedTransfers(username: string): DatedTransfer[] {
  return loadTransfers(username).flatMap(transfer => {
    const date = transfer.key.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(transfer.amount)) return [];
    return [{
      date,
      amount: Math.abs(transfer.amount),
      direction: storedTransferDirection(transfer),
      key: transfer.key,
      text: transfer.key.split('|').slice(2).join('|'),
    }];
  });
}

export function transferTotals(username: string, afterDate: string | null = null): { incoming: number; outgoing: number } {
  return loadDatedTransfers(username).reduce((totals, transfer) => {
    if (afterDate && transfer.date <= afterDate) return totals;
    if (transfer.direction === 'in') totals.incoming += transfer.amount;
    else totals.outgoing += transfer.amount;
    return totals;
  }, { incoming: 0, outgoing: 0 });
}

export function loadTransferTotal(username: string, afterDate: string | null = null): number {
  return transferTotals(username, afterDate).outgoing;
}

export function removeStoredTransfer(username: string, key: string): DatedTransfer[] {
  const next = loadTransfers(username).filter(transfer => transfer.key !== key);
  localStorage.setItem(transfersKey(username), JSON.stringify(next));
  return loadDatedTransfers(username);
}

function loadTransfers(username: string): StoredTransfer[] {
  const raw = localStorage.getItem(transfersKey(username));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function sameExpense(a: ExpenseItem, b: ExpenseItem): boolean {
  return a.date === b.date
    && a.merchant === b.merchant
    && a.amount === b.amount
    && (a.descriptionText || '') === (b.descriptionText || '');
}

export function setRecurringMonthly(username: string, target: ExpenseItem, recurring: boolean): ExpenseItem[] {
  const items = loadExpenses(username).map(item => (
    sameExpense(item, target) ? { ...item, recurringMonthly: recurring } : item
  ));
  localStorage.setItem(expensesKey(username), JSON.stringify(items));
  return items;
}

function seedSignature(item: ExpenseItem): string {
  return `${item.merchant.toLowerCase()}|${item.date}|${parseMoney(item.amount)}`;
}

function uniqueMerchants(items: ExpenseItem[], category: string): string[] {
  const names = items
    .filter(item => item.description.toLowerCase() === category)
    .map(item => item.merchant);
  return Array.from(new Set(names));
}

function topMerchant(items: ExpenseItem[], category: string): { merchant: string; amount: number } | null {
  const totals = new Map<string, number>();
  items.forEach(item => {
    if (item.description.toLowerCase() !== category) return;
    totals.set(item.merchant, (totals.get(item.merchant) || 0) + parseMoney(item.amount));
  });
  let best: { merchant: string; amount: number } | null = null;
  totals.forEach((amount, merchant) => {
    if (!best || amount > best.amount) best = { merchant, amount };
  });
  return best;
}

function subscriptionSuggestion(amount: number, names: string[]): string {
  const listed = names.slice(0, 4).join(', ');
  const who = listed ? ` (${listed})` : '';
  return `You spent ${formatMoney(amount)} on subscriptions${who}. Cancel any you are not using to save money.`;
}
