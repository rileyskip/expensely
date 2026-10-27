import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Pie } from 'react-chartjs-2';
import { Chart, ArcElement, Tooltip, Legend } from 'chart.js';
import { BalanceSnapshot, DatedTransfer, ExpenseItem, PaycheckSettings, SEED_EXPENSES, addRetroactivePaycheck, buildPaychecks, clearRecurringTemplate, descriptionStyle, estimatedRemainingByKey, formatMoney, includeInSchedule, latestBalanceSnapshot, loadBalanceSnapshots, loadDatedTransfers, loadExpenses, monthRange, parseDate, parseMoney, periodThroughToday, primaryAiSuggestion, projectedRecurringRows, removeBalanceSnapshot, removeRetroactivePaycheck, removeStoredTransfer, resolvePaycheckSettings, saveBalanceSnapshot, savePaycheckSettings, savingsSuggestion, sumByCategory, upcomingSuggestions, updateRecurringTemplate } from '../expenses';
Chart.register(ArcElement, Tooltip, Legend);

const statusClasses = {
  Scheduled: 'bg-blue-500',
  Pending: 'bg-yellow-500',
  Upcoming: 'bg-purple-500',
  Paid: 'bg-green-500',
};

const initialData: ExpenseItem[] = SEED_EXPENSES;

const BASE_DESCRIPTION_OPTIONS = [
  "bills",
  "subscriptions",
  "gas",
  "EZ Pass",
  "lunch",
  "breakfast",
  "Monster energy drink",
  "eating out",
  "bar",
  "subscription",
  "groceries",
  "utilities",
  "transportation",
  "insurance",
  "entertainment",
];

function descriptionChoicesKey(username: string): string {
  return `description_choices_${username}`;
}

function removedChoicesKey(username: string): string {
  return `description_removed_${username}`;
}

function loadStoredLabels(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string' && item.trim() !== '') : [];
  } catch {
    return [];
  }
}

function loadDescriptionChoices(username: string): string[] {
  return loadStoredLabels(descriptionChoicesKey(username));
}

function loadRemovedChoices(username: string): string[] {
  return loadStoredLabels(removedChoicesKey(username));
}

function descriptionLabel(value: string): string {
  if (value.toLowerCase() === 'ez pass') return 'EZ Pass';
  if (value.toLowerCase() === 'monster energy drink') return 'Monster energy drink';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function DescriptionBadge({ value }: { value: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-sm font-medium ${descriptionStyle(value).badge}`}>
      {descriptionLabel(value)}
    </span>
  );
}

function RemainingAmount({ value }: { value: number | undefined }) {
  if (value === undefined || !Number.isFinite(value)) return <span className="text-gray-400">—</span>;
  return <span className={`font-medium whitespace-nowrap ${value < 0 ? 'text-red-600' : 'text-gray-900'}`}>{formatMoney(value)}</span>;
}

type RowEdit =
  | { kind: 'expense'; index: number }
  | { kind: 'recurring'; source: ExpenseItem }
  | { kind: 'paycheck'; date: string; added: boolean }
  | { kind: 'balance'; date: string };

function mergeDescriptionOptions(custom: string[], removed: string[] = []): string[] {
  const hidden = new Set(removed.map(item => item.trim().toLowerCase()).filter(Boolean));
  const seen = new Set<string>();
  const merged: string[] = [];
  [...BASE_DESCRIPTION_OPTIONS, ...custom].forEach(option => {
    const trimmed = option.trim();
    const key = trimmed.toLowerCase();
    if (!key || key === 'other' || seen.has(key) || hidden.has(key)) return;
    seen.add(key);
    merged.push(trimmed);
  });
  merged.push('Other');
  return merged;
}

function matchingChoice(description: string, options: string[]): string | undefined {
  return options.find(option => option.toLowerCase() === description.trim().toLowerCase());
}

// Utility functions for date formatting and month extraction
function formatDateMMDDYYYY(dateStr: string): string {
  if (!dateStr) return '';
  const d = parseDate(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}
function getMonthYear(dateStr: string): string {
  if (!dateStr) return '';
  const d = parseDate(dateStr);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function countsAsSpending(item: ExpenseItem): boolean {
  return item.source !== 'transfer-in' && item.source !== 'transfer-out';
}

function amountClass(item: ExpenseItem): string {
  if (item.source === 'balance') return 'text-blue-700';
  if (item.source === 'transfer-out') return 'text-red-600';
  return 'text-green-600';
}

function transferRows(transfers: DatedTransfer[]): ExpenseItem[] {
  return transfers.map(transfer => ({
    merchant: transfer.text.replace(/\s+/g, ' ').trim().slice(0, 42) || (transfer.direction === 'in' ? 'Transfer in' : 'Transfer out'),
    date: transfer.date,
    amount: formatMoney(transfer.amount),
    description: transfer.direction === 'in' ? 'transfer in' : 'transfer out',
    descriptionText: transfer.text,
    need: false,
    status: 'Paid' as const,
    source: transfer.direction === 'in' ? 'transfer-in' as const : 'transfer-out' as const,
    transferKey: transfer.key,
  }));
}

function RowActions({
  onEdit,
  onDelete,
  onMarkTransferIn,
  transferInLabel,
}: {
  onEdit?: () => void;
  onDelete?: () => void;
  onMarkTransferIn?: () => void;
  transferInLabel?: string;
}) {
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const open = menuStyle !== null;

  const close = () => setMenuStyle(null);

  const toggle = () => {
    if (open) {
      close();
      return;
    }
    const button = rootRef.current?.querySelector('button');
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const width = 188;
    setMenuStyle({
      top: rect.bottom + 4,
      left: Math.max(8, rect.right - width),
    });
  };

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    const onScroll = () => close();
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  const choose = (action: () => void) => {
    close();
    action();
  };

  return (
    <div className="relative inline-block text-left" ref={rootRef}>
      <button
        type="button"
        aria-label="Row actions"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={toggle}
        className="p-2 rounded-md text-gray-500 hover:bg-gray-100"
      >
        <i className="fas fa-ellipsis-v" aria-hidden="true"></i>
      </button>
      {open && menuStyle && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{ position: 'fixed', top: menuStyle.top, left: menuStyle.left, width: 188 }}
          className="z-50 rounded-md bg-white shadow-lg border border-gray-200 py-1"
        >
          {onEdit && (
            <button
              type="button"
              role="menuitem"
              onMouseDown={(event) => {
                event.preventDefault();
                choose(onEdit);
              }}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Edit
            </button>
          )}
          {onMarkTransferIn && (
            <button
              type="button"
              role="menuitem"
              onMouseDown={(event) => {
                event.preventDefault();
                choose(onMarkTransferIn);
              }}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              {transferInLabel || 'Transferred in'}
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              role="menuitem"
              onMouseDown={(event) => {
                event.preventDefault();
                choose(onDelete);
              }}
              className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
            >
              Delete
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

function DescriptionField({
  value,
  otherText,
  options,
  onValueChange,
  onOtherTextChange,
  onAddChoice,
  onDeleteChoice,
  required = false,
  disabled = false,
}: {
  value: string;
  otherText: string;
  options: string[];
  onValueChange: (value: string) => void;
  onOtherTextChange: (value: string) => void;
  onAddChoice: (label: string) => void;
  onDeleteChoice: (label: string) => void;
  required?: boolean;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState('');

  const addChoice = () => {
    const label = draft.trim();
    if (!label) return;
    onAddChoice(label);
    setDraft('');
  };

  const commitOther = () => {
    const label = otherText.trim();
    if (!label || label.toLowerCase() === 'other') return;
    onAddChoice(label);
  };

  return (
    <div className="space-y-2 min-w-[12rem]">
      <select
        aria-label="Description"
        value={value}
        onChange={event => onValueChange(event.target.value)}
        className="block w-full rounded-md border-gray-300 shadow-sm form-input disabled:bg-gray-100"
        required={required}
        disabled={disabled}
      >
        <option value="">Select...</option>
        {options.map(option => (
          <option key={option} value={option}>{descriptionLabel(option)}</option>
        ))}
        {value && !options.some(option => option.toLowerCase() === value.toLowerCase()) && (
          <option value={value}>{descriptionLabel(value)}</option>
        )}
      </select>
      {!disabled && value === 'Other' && (
        <input
          type="text"
          aria-label="Optional description"
          placeholder="Optional description"
          value={otherText}
          onChange={event => onOtherTextChange(event.target.value)}
          onBlur={commitOther}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitOther();
            }
          }}
          className="block w-full rounded-md border-gray-300 shadow-sm form-input"
        />
      )}
      {!disabled && value && value !== 'Other' && (
        <button
          type="button"
          onClick={() => {
            onDeleteChoice(value);
            onValueChange('');
            onOtherTextChange('');
          }}
          className="text-sm text-red-600 hover:text-red-700"
        >
          Remove choice
        </button>
      )}
      {!disabled && (
      <div className="flex gap-2">
        <input
          type="text"
          aria-label="New description choice"
          placeholder="Add a choice"
          value={draft}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addChoice();
            }
          }}
          className="block w-full rounded-md border-gray-300 shadow-sm form-input"
        />
        <button
          type="button"
          onClick={addChoice}
          className="shrink-0 bg-blue-500 text-white px-3 py-2 rounded-md hover:bg-blue-600 text-sm"
        >
          Add
        </button>
      </div>
      )}
    </div>
  );
}

const ExpenseTracker: React.FC<{ username: string }> = ({ username }) => {
  const normalizedUsername = username.trim().toLowerCase();
  const [spendingData, setSpendingData] = useState<ExpenseItem[]>(initialData);
  const [showAddForm, setShowAddForm] = useState(false);
  const [entryKind, setEntryKind] = useState<'expense' | 'paycheck' | 'transfer-in'>('expense');
  const [panel, setPanel] = useState<'expenses' | 'insights'>('expenses');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<RowEdit | null>(null);
  const [newExpense, setNewExpense] = useState<Omit<ExpenseItem, 'amount'> & { amount: number }>({
    merchant: '',
    date: '',
    amount: 0,
    description: '',
    descriptionText: '',
    need: false,
    status: 'Scheduled',
  });
  const [editExpense, setEditExpense] = useState<ExpenseItem | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedDescription, setSelectedDescription] = useState<string>('all');
  const [customChoices, setCustomChoices] = useState<string[]>(() => loadDescriptionChoices(normalizedUsername));
  const [removedChoices, setRemovedChoices] = useState<string[]>(() => loadRemovedChoices(normalizedUsername));
  const [editOtherText, setEditOtherText] = useState('');
  const [paycheckSettings, setPaycheckSettings] = useState<PaycheckSettings | null>(() => resolvePaycheckSettings(normalizedUsername));
  const [payInterval, setPayInterval] = useState('14');
  const [pastPayNote, setPastPayNote] = useState('');
  const [balanceSnapshots, setBalanceSnapshots] = useState<BalanceSnapshot[]>(() => loadBalanceSnapshots(normalizedUsername));
  const [statementTransfers, setStatementTransfers] = useState<DatedTransfer[]>(() => loadDatedTransfers(normalizedUsername));
  const [balanceDate, setBalanceDate] = useState('');
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceNote, setBalanceNote] = useState('');
  const [readyFor, setReadyFor] = useState<string | null>(null);
  const ready = readyFor === normalizedUsername;

  // Load expenses for this user on mount/username change
  useEffect(() => {
    const saved = localStorage.getItem(`expenses_${normalizedUsername}`);
    if (saved) {
      setSpendingData(loadExpenses(normalizedUsername));
    } else {
      setSpendingData(initialData);
    }
    setReadyFor(normalizedUsername);
    setPaycheckSettings(resolvePaycheckSettings(normalizedUsername));
    setBalanceSnapshots(loadBalanceSnapshots(normalizedUsername));
    setStatementTransfers(loadDatedTransfers(normalizedUsername));
    setCustomChoices(loadDescriptionChoices(normalizedUsername));
    setRemovedChoices(loadRemovedChoices(normalizedUsername));
    setSelectedDescription('all');
  }, [normalizedUsername]);

  // Save expenses for this user whenever they change
  useEffect(() => {
    if (!ready) return;
    const key = `expenses_${normalizedUsername}`;
    const updatedData = [...spendingData];
    localStorage.setItem(key, JSON.stringify(updatedData));
  }, [spendingData, normalizedUsername, ready]);

  useEffect(() => {
    const scoped = selectedMonth === 'all'
      ? spendingData
      : spendingData.filter(item => getMonthYear(item.date) === selectedMonth);
    const range = selectedMonth === 'all'
      ? periodThroughToday(scoped, new Date(), paycheckSettings?.anchor, paycheckSettings?.extraDates)
      : monthRange(selectedMonth);
    const snapshot = latestBalanceSnapshot(balanceSnapshots, range.end);
    const spendingScoped = scoped.filter(countsAsSpending);
    const savingsItems = (snapshot
      ? spendingData.filter(item => item.date > snapshot.date && item.date <= range.end)
      : scoped).filter(countsAsSpending);
    const inRange = (date: string) => (!snapshot || date > snapshot.date) && date >= range.start && date <= range.end;
    const statementIn = statementTransfers.reduce((sum, transfer) => (
      transfer.direction === 'in' && inRange(transfer.date) ? sum + transfer.amount : sum
    ), 0);
    const savingsSetAside = statementTransfers.reduce((sum, transfer) => (
      transfer.direction === 'out' && inRange(transfer.date) ? sum + transfer.amount : sum
    ), 0);
    const manualIn = spendingData.reduce((sum, item) => (
      item.source === 'transfer-in' && inRange(item.date) ? sum + Math.abs(parseMoney(item.amount)) : sum
    ), 0);
    const primary = primaryAiSuggestion(sumByCategory(spendingScoped));
    const savings = savingsSuggestion(
      savingsItems,
      savingsSetAside,
      snapshot ? { start: snapshot.date, end: range.end } : range,
      paycheckSettings,
      snapshot,
      statementIn + manualIn
    );
    const upcoming = upcomingSuggestions(spendingData, paycheckSettings, new Date(), {
      promptPaycheck: true,
      promptMonthly: false,
    });
    const next = [primary, savings, ...upcoming].filter(Boolean).join(' ');
    setSuggestion(next || null);
  }, [spendingData, normalizedUsername, selectedMonth, paycheckSettings, balanceSnapshots, statementTransfers]);

  const paychecks = buildPaychecks(new Date(), paycheckSettings).filter(item => includeInSchedule(item));

  const addPastPaycheck = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newExpense.date)) {
      setPastPayNote('Choose a paycheck date.');
      return;
    }
    if (!paycheckSettings) {
      const amount = Math.abs(Number(newExpense.amount));
      const interval = Math.round(Number(payInterval));
      if (!Number.isFinite(amount) || amount <= 0) {
        setPastPayNote('Enter the paycheck amount.');
        return;
      }
      if (!Number.isFinite(interval) || interval < 1) {
        setPastPayNote('Choose how often the paycheck arrives.');
        return;
      }
      const settings = { amount, intervalDays: interval, anchor: newExpense.date, extraDates: [] as string[] };
      savePaycheckSettings(normalizedUsername, settings);
      setPaycheckSettings(settings);
      setPastPayNote('');
      setShowAddForm(false);
      setEntryKind('expense');
      setNewExpense(current => ({ ...current, date: '', amount: 0 }));
      return;
    }
    const result = addRetroactivePaycheck(normalizedUsername, newExpense.date);
    if (!result.added || !result.settings) {
      setPastPayNote(result.already ? 'That paycheck is already on the schedule.' : 'Choose a paycheck date.');
      return;
    }
    setPaycheckSettings(result.settings);
    setPastPayNote('');
    setShowAddForm(false);
    setEntryKind('expense');
    setNewExpense(current => ({ ...current, date: '' }));
  };

  const addTransferIn = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newExpense.date)) {
      setPastPayNote('Choose the date the money was transferred in.');
      return;
    }
    const amount = Math.abs(Number(newExpense.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      setPastPayNote('Enter the amount that was transferred in.');
      return;
    }
    setSpendingData(current => [...current, {
      merchant: newExpense.merchant.trim() || 'Transfer in',
      date: newExpense.date,
      amount: formatMoney(amount),
      description: 'transfer in',
      descriptionText: 'Transferred in',
      need: false,
      status: 'Paid',
      source: 'transfer-in',
      descriptionManual: true,
    }]);
    setPastPayNote('');
    setShowAddForm(false);
    setEntryKind('expense');
    setNewExpense(current => ({ ...current, merchant: '', date: '', amount: 0, description: '', descriptionText: '' }));
  };

  const markTransferredIn = (index: number, transferredIn: boolean) => {
    setSpendingData(current => current.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      if (!transferredIn) {
        const next = { ...item };
        delete next.source;
        return next;
      }
      return { ...item, source: 'transfer-in', descriptionManual: true };
    }));
  };

  const closeAddForm = () => {
    setShowAddForm(false);
    setEntryKind('expense');
    setPastPayNote('');
  };

  const removePastPaycheck = (date: string) => {
    const next = removeRetroactivePaycheck(normalizedUsername, date);
    if (next) setPaycheckSettings(next);
  };

  const addBalance = (event: React.FormEvent) => {
    event.preventDefault();
    const amount = Number(balanceAmount);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(balanceDate)) {
      setBalanceNote('Choose the date of this balance.');
      return;
    }
    if (!Number.isFinite(amount)) {
      setBalanceNote('Enter the current account balance.');
      return;
    }
    const next = saveBalanceSnapshot(normalizedUsername, balanceDate, amount);
    if (!next) {
      setBalanceNote('Choose the date of this balance.');
      return;
    }
    setBalanceSnapshots(next);
    setBalanceNote('Account balance recorded.');
    setBalanceDate('');
    setBalanceAmount('');
  };

  const removeBalance = (date: string) => {
    setBalanceSnapshots(removeBalanceSnapshot(normalizedUsername, date));
  };

  const balanceItems: ExpenseItem[] = balanceSnapshots.map(snap => ({
    merchant: 'Account balance',
    date: snap.date,
    amount: formatMoney(snap.amount),
    description: 'account balance',
    descriptionText: 'Balance recorded',
    need: true,
    status: 'Paid',
    source: 'balance',
  }));
  const descriptionOptions = mergeDescriptionOptions(customChoices, removedChoices);
  const matchesDescription = (description: string) =>
    selectedDescription === 'all' || description.toLowerCase() === selectedDescription;

  const recurringItems = projectedRecurringRows(spendingData);
  const rowKey = (item: ExpenseItem, index: number) =>
    item.transferKey ? `transfer-${item.transferKey}` : index >= 0 ? `expense-${index}` : `${item.source || 'row'}-${item.date}-${item.merchant}-${item.amount}`;
  const importedTransfers = transferRows(statementTransfers);
  const scheduleRows = [
    ...spendingData.map((item, index) => ({ item, index })),
    ...paychecks.map(item => ({ item, index: -1 })),
    ...balanceItems.map(item => ({ item, index: -1 })),
    ...recurringItems.map(item => ({ item, index: -1 })),
    ...importedTransfers.map(item => ({ item, index: -1 })),
  ];
  const remainingByKey = estimatedRemainingByKey(
    scheduleRows.map(row => ({ key: rowKey(row.item, row.index), item: row.item }))
  );
  const displayRows = scheduleRows
    .filter(row => (selectedMonth === 'all' || getMonthYear(row.item.date) === selectedMonth) && matchesDescription(row.item.description))
    .sort((a, b) => b.item.date.localeCompare(a.item.date) || a.item.merchant.localeCompare(b.item.merchant));

  // Get all unique months from spending and the paycheck schedule
  const monthSet = new Set<string>();
  [...spendingData, ...paychecks, ...balanceItems, ...recurringItems, ...importedTransfers].forEach(exp => {
    const m = getMonthYear(exp.date);
    if (m) monthSet.add(m);
  });
  const months = Array.from(monthSet).sort().reverse(); // latest first
  const monthLabels = months.map(m => {
    const [year, month] = m.split('-');
    const d = new Date(Number(year), Number(month) - 1, 1);
    return `${d.toLocaleString('default', { month: 'long' })} ${year}`;
  });

  // Filtered data for chart
  const filteredData = spendingData.filter(exp =>
    countsAsSpending(exp)
    && (selectedMonth === 'all' || getMonthYear(exp.date) === selectedMonth)
    && matchesDescription(exp.description)
  );

  const descriptionFilters = Array.from(new Set(
    [...descriptionOptions, ...spendingData.map(item => item.description), ...paychecks.map(item => item.description), ...balanceItems.map(item => item.description), ...importedTransfers.map(item => item.description)]
      .map(value => value.trim())
      .filter(Boolean)
      .map(value => value.toLowerCase())
  )).sort((a, b) => descriptionLabel(a).localeCompare(descriptionLabel(b)));

  const saveDescriptionLists = (custom: string[], removed: string[]) => {
    localStorage.setItem(descriptionChoicesKey(normalizedUsername), JSON.stringify(custom));
    localStorage.setItem(removedChoicesKey(normalizedUsername), JSON.stringify(removed));
    setCustomChoices(custom);
    setRemovedChoices(removed);
  };

  const addDescriptionChoice = (label: string): string | null => {
    const trimmed = label.trim();
    if (!trimmed || trimmed.toLowerCase() === 'other') return null;
    const removed = removedChoices.filter(item => item.trim().toLowerCase() !== trimmed.toLowerCase());
    const existing = matchingChoice(trimmed, mergeDescriptionOptions(customChoices, removed));
    if (existing) {
      if (removed.length !== removedChoices.length) saveDescriptionLists(customChoices, removed);
      return existing;
    }
    saveDescriptionLists([...customChoices, trimmed], removed);
    return trimmed;
  };

  const deleteDescriptionChoice = (label: string) => {
    const key = label.trim().toLowerCase();
    if (!key || key === 'other') return;
    const custom = customChoices.filter(item => item.trim().toLowerCase() !== key);
    const removed = removedChoices.some(item => item.trim().toLowerCase() === key)
      ? removedChoices
      : [...removedChoices, key];
    saveDescriptionLists(custom, removed);
    if (selectedDescription.toLowerCase() === key) setSelectedDescription('all');
  };

  const resolvedDescription = (choice: string, otherText: string): string =>
    choice === 'Other' ? otherText.trim() || 'Other' : choice;

  // Calculate category totals for filtered data
  const categoryTotals: { [key: string]: number } = {};
  filteredData.forEach(exp => {
    const cat = exp.description.toLowerCase();
    const amt = parseMoney(exp.amount);
    categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
  });

  const pieData = {
    labels: Object.keys(categoryTotals).map(
      cat => cat.charAt(0).toUpperCase() + cat.slice(1)
    ),
    datasets: [
      {
        data: Object.values(categoryTotals),
        backgroundColor: Object.keys(categoryTotals).map(cat => descriptionStyle(cat).hex),
      },
    ],
  };

  const handleAddExpense = () => {
    const description = resolvedDescription(newExpense.description, newExpense.descriptionText || '');
    addDescriptionChoice(description);
    const formattedExpense: ExpenseItem = {
      ...newExpense,
      description,
      descriptionText: '',
      descriptionManual: true,
      amount: `$${newExpense.amount.toFixed(2)}`,
    };
    const updatedData = [...spendingData, formattedExpense];
    setSpendingData(updatedData);
    // Save updated data to localStorage immediately
    const key = `expenses_${normalizedUsername}`;
    console.log('Saving data with key:', key);
    console.log('Data being saved:', updatedData);
    localStorage.setItem(key, JSON.stringify(updatedData));
    setShowAddForm(false);
    setNewExpense({
      merchant: '',
      date: '',
      amount: 0,
      description: '',
      descriptionText: '',
      need: false,
      status: 'Scheduled',
      recurringMonthly: false,
    });
  };

  const handleDelete = (index: number) => {
    const updatedData = spendingData.filter((_, i) => i !== index);
    setSpendingData(updatedData);
    // Save updated data to localStorage immediately
    const key = `expenses_${normalizedUsername}`;
    console.log('Saving data with key:', key);
    console.log('Data being saved:', updatedData);
    localStorage.setItem(key, JSON.stringify(updatedData));
  };

  const beginEdit = (item: ExpenseItem, index: number) => {
    const choice = matchingChoice(item.description, descriptionOptions);
    const locked = index < 0 && (item.source === 'paycheck' || item.source === 'balance');
    setEditingKey(rowKey(item, index));
    setEditExpense({ ...item, description: choice || (locked ? item.description : 'Other') });
    setEditOtherText(choice || locked ? '' : item.description);
    if (index >= 0) {
      setEditTarget({ kind: 'expense', index });
    } else if (item.source === 'recurring') {
      setEditTarget({ kind: 'recurring', source: item });
    } else if (item.source === 'paycheck') {
      setEditTarget({ kind: 'paycheck', date: item.date, added: item.descriptionText === 'Paycheck added' });
    } else if (item.source === 'balance') {
      setEditTarget({ kind: 'balance', date: item.date });
    }
  };

  const formattedEditAmount = (amount: ExpenseItem['amount']): string => (
    typeof amount === 'string' ? amount : formatMoney(parseMoney(amount))
  );

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (!editExpense) return;
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      setEditExpense({
        ...editExpense,
        [name]: (e.target as HTMLInputElement).checked,
      });
    } else {
      setEditExpense({
        ...editExpense,
        [name]: value,
      });
    }
  };

  const handleSave = () => {
    if (!editExpense || !editTarget) return;
    const description = resolvedDescription(editExpense.description, editOtherText);
    const amount = formattedEditAmount(editExpense.amount);

    if (editTarget.kind === 'expense') {
      addDescriptionChoice(description);
      const updatedData = [...spendingData];
      const original = updatedData[editTarget.index];
      if (!original) return;
      updatedData[editTarget.index] = {
        ...original,
        merchant: editExpense.merchant,
        date: editExpense.date,
        amount,
        description,
        need: editExpense.need,
        status: editExpense.status,
        recurringMonthly: !!editExpense.recurringMonthly,
        descriptionManual: true,
      };
      setSpendingData(updatedData);
    } else if (editTarget.kind === 'recurring') {
      addDescriptionChoice(description);
      setSpendingData(updateRecurringTemplate(spendingData, editTarget.source, {
        ...editExpense,
        description,
        amount,
        recurringMonthly: !!editExpense.recurringMonthly,
      }));
    } else if (editTarget.kind === 'paycheck' && paycheckSettings) {
      const paycheckAmount = parseMoney(amount);
      if (paycheckAmount <= 0) return;
      let extraDates = [...(paycheckSettings.extraDates || [])];
      if (editTarget.added) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(editExpense.date)) return;
        extraDates = extraDates.filter(date => date !== editTarget.date);
        const alreadyScheduled = buildPaychecks(new Date(), { ...paycheckSettings, extraDates: [] })
          .some(item => item.date === editExpense.date);
        if (!alreadyScheduled && !extraDates.includes(editExpense.date)) extraDates.push(editExpense.date);
        extraDates.sort();
      }
      const next = { ...paycheckSettings, amount: paycheckAmount, extraDates };
      savePaycheckSettings(normalizedUsername, next);
      setPaycheckSettings(next);
    } else if (editTarget.kind === 'balance') {
      const balanceValue = parseMoney(amount);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(editExpense.date) || !Number.isFinite(balanceValue)) return;
      if (editExpense.date !== editTarget.date) removeBalanceSnapshot(normalizedUsername, editTarget.date);
      const saved = saveBalanceSnapshot(normalizedUsername, editExpense.date, balanceValue);
      if (!saved) return;
      setBalanceSnapshots(saved);
    } else {
      return;
    }

    setEditingKey(null);
    setEditTarget(null);
    setEditExpense(null);
    setEditOtherText('');
  };

  const handleCancel = () => {
    setEditingKey(null);
    setEditTarget(null);
    setEditExpense(null);
    setEditOtherText('');
  };

  const deleteRow = (item: ExpenseItem, index: number) => {
    if (index >= 0) {
      handleDelete(index);
    } else if (item.source === 'recurring') {
      setSpendingData(clearRecurringTemplate(spendingData, item));
    } else if (item.descriptionText === 'Paycheck added') {
      removePastPaycheck(item.date);
    } else if (item.transferKey) {
      setStatementTransfers(removeStoredTransfer(normalizedUsername, item.transferKey));
    } else if (item.source === 'balance') {
      removeBalance(item.date);
    }
    if (editingKey === rowKey(item, index)) handleCancel();
  };

  const identityLocked = editTarget?.kind === 'paycheck' || editTarget?.kind === 'balance';
  const dateLocked = editTarget?.kind === 'paycheck' && !editTarget.added;
  const statusLocked = identityLocked || editTarget?.kind === 'recurring';

  const monthTabs = (
    <div className="flex flex-wrap gap-2 mb-4">
      <button
        className={`px-4 py-2 rounded-md border ${selectedMonth === 'all' ? 'bg-blue-500 text-white' : 'bg-white text-blue-500 border-blue-500'} transition`}
        onClick={() => setSelectedMonth('all')}
      >
        All months
      </button>
      {months.map((m, i) => (
        <button
          key={m}
          className={`px-4 py-2 rounded-md border ${selectedMonth === m ? 'bg-blue-500 text-white' : 'bg-white text-blue-500 border-blue-500'} transition`}
          onClick={() => setSelectedMonth(m)}
        >
          {monthLabels[i]}
        </button>
      ))}
    </div>
  );

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4 md:mb-0">
          Your Expense Manager
        </h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 btn w-full md:w-auto"
        >
          Add New Expense
        </button>
      </div>

      <form onSubmit={addBalance} className="mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="balance-date" className="block text-sm font-medium text-gray-700">Account balance date</label>
          <input
            id="balance-date"
            type="date"
            value={balanceDate}
            onChange={event => setBalanceDate(event.target.value)}
            className="mt-1 block rounded-md border-gray-300 shadow-sm form-input"
          />
        </div>
        <div>
          <label htmlFor="balance-amount" className="block text-sm font-medium text-gray-700">Current balance</label>
          <input
            id="balance-amount"
            type="number"
            step="0.01"
            value={balanceAmount}
            onChange={event => setBalanceAmount(event.target.value)}
            className="mt-1 block rounded-md border-gray-300 shadow-sm form-input"
          />
        </div>
        <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 btn">
          Add balance
        </button>
        {balanceNote && <p className="text-sm text-gray-600">{balanceNote}</p>}
      </form>

      {showAddForm && (
        <div className="mb-8 p-6 bg-white rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4">{entryKind === 'paycheck' ? 'Add paycheck' : entryKind === 'transfer-in' ? 'Add transfer in' : 'Add New Expense'}</h2>
          <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="What to add">
            <button
              type="button"
              onClick={() => { setEntryKind('expense'); setPastPayNote(''); }}
              className={`px-4 py-2 rounded-md border ${entryKind === 'expense' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-blue-500 border-blue-500'}`}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => { setEntryKind('paycheck'); setPastPayNote(''); }}
              className={`px-4 py-2 rounded-md border ${entryKind === 'paycheck' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-blue-500 border-blue-500'}`}
            >
              Paycheck
            </button>
            <button
              type="button"
              onClick={() => { setEntryKind('transfer-in'); setPastPayNote(''); }}
              className={`px-4 py-2 rounded-md border ${entryKind === 'transfer-in' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-blue-500 border-blue-500'}`}
            >
              Transfer in
            </button>
          </div>
          {entryKind === 'paycheck' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {!paycheckSettings && (
                <>
                  <div>
                    <label htmlFor="paycheck-amount" className="block text-sm font-medium text-gray-700">Amount</label>
                    <input
                      id="paycheck-amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={newExpense.amount || ''}
                      onChange={event => setNewExpense(current => ({ ...current, amount: parseFloat(event.target.value) }))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm form-input"
                    />
                  </div>
                  <div>
                    <label htmlFor="paycheck-interval" className="block text-sm font-medium text-gray-700">Every how many days</label>
                    <input
                      id="paycheck-interval"
                      type="number"
                      min="1"
                      step="1"
                      value={payInterval}
                      onChange={event => setPayInterval(event.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm form-input"
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[{ days: '7', label: 'Weekly' }, { days: '14', label: 'Every 2 weeks' }, { days: '30', label: 'Every 30 days' }].map(preset => (
                        <button
                          key={preset.days}
                          type="button"
                          onClick={() => setPayInterval(preset.days)}
                          className={`px-3 py-1 rounded-md border text-sm ${payInterval === preset.days ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-blue-600 border-blue-500'}`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
              <div>
                <label htmlFor="past-paycheck" className="block text-sm font-medium text-gray-700">Paycheck date</label>
                <input
                  id="past-paycheck"
                  type="date"
                  value={newExpense.date}
                  onChange={event => setNewExpense(current => ({ ...current, date: event.target.value }))}
                  className="mt-1 block rounded-md border-gray-300 shadow-sm form-input"
                />
              </div>
              <p className="md:col-span-2 text-sm text-gray-600">
                {paycheckSettings
                  ? `Adds ${formatMoney(paycheckSettings.amount)} on that date, using the amount already set for the schedule.`
                  : 'Sets how much arrives and how often, starting on that date.'}
              </p>
              {pastPayNote && <p className="md:col-span-2 text-sm text-gray-600">{pastPayNote}</p>}
            </div>
          ) : entryKind === 'transfer-in' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="transfer-in-date" className="block text-sm font-medium text-gray-700">Date</label>
                <input
                  id="transfer-in-date"
                  type="date"
                  value={newExpense.date}
                  onChange={event => setNewExpense(current => ({ ...current, date: event.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm form-input"
                />
              </div>
              <div>
                <label htmlFor="transfer-in-amount" className="block text-sm font-medium text-gray-700">Amount</label>
                <input
                  id="transfer-in-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={newExpense.amount || ''}
                  onChange={event => setNewExpense(current => ({ ...current, amount: parseFloat(event.target.value) }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm form-input"
                />
              </div>
              <div>
                <label htmlFor="transfer-in-from" className="block text-sm font-medium text-gray-700">From</label>
                <input
                  id="transfer-in-from"
                  type="text"
                  placeholder="Savings or another account"
                  value={newExpense.merchant}
                  onChange={event => setNewExpense(current => ({ ...current, merchant: event.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm form-input"
                />
              </div>
              <p className="md:col-span-2 text-sm text-gray-600">
                Adds this amount to the estimated balance. It stays separate from the paycheck schedule.
              </p>
              {pastPayNote && <p className="md:col-span-2 text-sm text-gray-600">{pastPayNote}</p>}
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Merchant</label>
              <input
                type="text"
                value={newExpense.merchant}
                onChange={(e) => setNewExpense({ ...newExpense, merchant: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm form-input"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Date</label>
              <input
                type="date"
                value={newExpense.date}
                onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm form-input"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Amount</label>
              <input
                type="number"
                step="0.01"
                value={newExpense.amount}
                onChange={(e) => setNewExpense({ ...newExpense, amount: parseFloat(e.target.value) })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm form-input"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <div className="mt-1">
                <DescriptionField
                  required
                  value={newExpense.description}
                  otherText={newExpense.descriptionText || ''}
                  options={descriptionOptions}
                  onValueChange={value => setNewExpense(current => ({ ...current, description: value }))}
                  onOtherTextChange={value => setNewExpense(current => ({ ...current, descriptionText: value }))}
                  onAddChoice={label => {
                    const choice = addDescriptionChoice(label);
                    if (!choice) return;
                    setNewExpense(current => ({ ...current, description: choice, descriptionText: '' }));
                  }}
                  onDeleteChoice={deleteDescriptionChoice}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Need</label>
              <input
                type="checkbox"
                checked={newExpense.need}
                onChange={(e) => setNewExpense({ ...newExpense, need: e.target.checked })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Recurring</label>
              <input
                type="checkbox"
                checked={!!newExpense.recurringMonthly}
                onChange={(e) => setNewExpense({ ...newExpense, recurringMonthly: e.target.checked })}
                className="mt-1"
              />
              <span className="ml-2 text-sm text-gray-600">Repeats monthly</span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <select
                value={newExpense.status}
                onChange={(e) => setNewExpense({ ...newExpense, status: e.target.value as ExpenseItem['status'] })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm form-input"
              >
                <option value="Scheduled">Scheduled</option>
                <option value="Pending">Pending</option>
                <option value="Upcoming">Upcoming</option>
                <option value="Paid">Paid</option>
              </select>
            </div>
          </div>
          )}
          <div className="mt-4 flex justify-end space-x-2">
            <button
              onClick={closeAddForm}
              className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 btn"
            >
              Cancel
            </button>
            <button
              onClick={entryKind === 'paycheck' ? addPastPaycheck : entryKind === 'transfer-in' ? addTransferIn : handleAddExpense}
              className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 btn"
            >
              {entryKind === 'paycheck' ? 'Add paycheck' : entryKind === 'transfer-in' ? 'Add transfer in' : 'Add Expense'}
            </button>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Expense views">
        <button
          type="button"
          role="tab"
          aria-selected={panel === 'expenses'}
          onClick={() => setPanel('expenses')}
          className={`px-4 py-2 rounded-md border ${panel === 'expenses' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-blue-500 border-blue-500'}`}
        >
          Expenses
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={panel === 'insights'}
          onClick={() => setPanel('insights')}
          className={`px-4 py-2 rounded-md border ${panel === 'insights' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-blue-500 border-blue-500'}`}
        >
          Insights
        </button>
      </div>

      {panel === 'expenses' && (
      <div>
          {monthTabs}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <label htmlFor="description-filter" className="text-sm font-medium text-gray-700">Description</label>
            <select
              id="description-filter"
              aria-label="Filter by description"
              value={selectedDescription}
              onChange={event => setSelectedDescription(event.target.value)}
              className="rounded-md border-gray-300 shadow-sm form-input"
            >
              <option value="all">All descriptions</option>
              {descriptionFilters.map(value => (
                <option key={value} value={value}>{descriptionLabel(value)}</option>
              ))}
            </select>
          </div>
          {/* Table for md+ screens */}
          <div className="w-full overflow-x-auto hidden md:block">
            <table className="min-w-full w-full bg-white rounded-lg overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Merchant</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estimated remaining</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Need</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map(({ item, index }) => (
                  <tr key={rowKey(item, index)} className="border-b">
                    {editingKey === rowKey(item, index) ? (
                      <>
                        <td className="py-3 px-4 align-top">
                          <span className="block md:hidden text-xs text-gray-500 font-semibold mb-1">Merchant</span>
                          <input
                            type="text"
                            name="merchant"
                            value={editExpense?.merchant || ''}
                            onChange={handleEditChange}
                            disabled={identityLocked}
                            className="block w-full rounded-md border-gray-300 shadow-sm form-input disabled:bg-gray-100"
                          />
                        </td>
                        <td className="py-3 px-4 align-top">
                          <span className="block md:hidden text-xs text-gray-500 font-semibold mb-1">Date</span>
                          <input
                            type="date"
                            name="date"
                            value={editExpense?.date || ''}
                            onChange={handleEditChange}
                            disabled={dateLocked}
                            className="block w-full rounded-md border-gray-300 shadow-sm form-input disabled:bg-gray-100"
                          />
                        </td>
                        <td className="py-3 px-4 align-top">
                          <span className="block md:hidden text-xs text-gray-500 font-semibold mb-1">Amount</span>
                          <input
                            type="text"
                            name="amount"
                            value={editExpense?.amount || ''}
                            onChange={handleEditChange}
                            className="block w-full rounded-md border-gray-300 shadow-sm form-input"
                          />
                          {editTarget?.kind === 'paycheck' && (
                            <span className="block text-xs text-gray-500 mt-1">Applies to every paycheck</span>
                          )}
                          {editTarget?.kind === 'recurring' && (
                            <span className="block text-xs text-gray-500 mt-1">Updates this monthly bill</span>
                          )}
                        </td>
                        <td className="py-3 px-4 align-top">
                          <RemainingAmount value={remainingByKey.get(rowKey(item, index))} />
                        </td>
                        <td className="py-3 px-4 align-top">
                          <span className="block md:hidden text-xs text-gray-500 font-semibold mb-1">Description</span>
                          <DescriptionField
                            value={editExpense?.description || ''}
                            otherText={editOtherText}
                            options={descriptionOptions}
                            disabled={identityLocked}
                            onValueChange={value => setEditExpense(current => current ? { ...current, description: value } : current)}
                            onOtherTextChange={setEditOtherText}
                            onAddChoice={label => {
                              const choice = addDescriptionChoice(label);
                              if (!choice) return;
                              setEditExpense(current => current ? { ...current, description: choice } : current);
                              setEditOtherText('');
                            }}
                            onDeleteChoice={deleteDescriptionChoice}
                          />
                        </td>
                        <td className="py-3 px-4 align-top">
                          <span className="block md:hidden text-xs text-gray-500 font-semibold mb-1">Need</span>
                          <input
                            type="checkbox"
                            name="need"
                            checked={!!editExpense?.need}
                            onChange={handleEditChange}
                            disabled={identityLocked}
                            className="mt-1"
                          />
                          <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              name="recurringMonthly"
                              checked={!!editExpense?.recurringMonthly}
                              onChange={handleEditChange}
                              disabled={identityLocked}
                            />
                            Recurring
                          </label>
                        </td>
                        <td className="py-3 px-4 align-top">
                          <span className="block md:hidden text-xs text-gray-500 font-semibold mb-1">Status</span>
                          <select
                            name="status"
                            value={editExpense?.status || 'Scheduled'}
                            onChange={handleEditChange}
                            disabled={statusLocked}
                            className="block w-full rounded-md border-gray-300 shadow-sm form-input disabled:bg-gray-100"
                          >
                            <option value="Scheduled">Scheduled</option>
                            <option value="Pending">Pending</option>
                            <option value="Upcoming">Upcoming</option>
                            <option value="Paid">Paid</option>
                          </select>
                        </td>
                        <td className="py-3 px-4 align-top">
                          <div className="flex flex-col xl:flex-row space-y-2 xl:space-y-0 xl:space-x-2">
                            <button
                              onClick={handleSave}
                              className="bg-green-500 text-white py-2 px-3 rounded w-full xl:w-auto"
                            >
                              Save
                            </button>
                            <button
                              onClick={handleCancel}
                              className="bg-gray-500 text-white py-2 px-3 rounded w-full xl:w-auto"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-3 px-4 align-top">
                          <span className="block md:hidden text-xs text-gray-500 font-semibold mb-1">Merchant</span>
                          <span className="block md:inline mt-1 md:mt-0">{item.merchant}</span>
                        </td>
                        <td className="py-3 px-4 align-top">
                          <span className="block md:hidden text-xs text-gray-500 font-semibold mb-1">Date</span>
                          <span className="block md:inline mt-1 md:mt-0">{formatDateMMDDYYYY(item.date)}</span>
                        </td>
                        <td className="py-3 px-4 align-top">
                          <span className="block md:hidden text-xs text-gray-500 font-semibold mb-1">Amount</span>
                          <span className={`block md:inline mt-1 md:mt-0 font-bold ${amountClass(item)}`}>{item.amount}</span>
                        </td>
                        <td className="py-3 px-4 align-top">
                          <RemainingAmount value={remainingByKey.get(rowKey(item, index))} />
                        </td>
                        <td className="py-3 px-4 align-top">
                          <span className="block md:hidden text-xs text-gray-500 font-semibold mb-1">Description</span>
                          <span className="block md:inline mt-1 md:mt-0"><DescriptionBadge value={item.description} /></span>
                          {item.recurringMonthly && <span className="block text-xs text-gray-500">Recurring monthly</span>}
                        </td>
                        <td className="py-3 px-4 align-top">
                          <span className="block md:hidden text-xs text-gray-500 font-semibold mb-1">Need</span>
                          <span className="block md:inline mt-1 md:mt-0">
                            <i className={`fas ${item.need ? 'fa-check text-green-500' : 'fa-times text-red-500'}`}></i>
                          </span>
                        </td>
                        <td className="py-3 px-4 align-top">
                          <span className="block md:hidden text-xs text-gray-500 font-semibold mb-1">Status</span>
                          <span className="block md:inline mt-1 md:mt-0">
                            {item.source === 'balance' ? (
                              <span className="bg-blue-500 text-white py-1 px-3 rounded">Recorded</span>
                            ) : (
                              <button className={`${statusClasses[item.status]} text-white py-1 px-3 rounded`}>
                                {item.status}
                              </button>
                            )}
                          </span>
                        </td>
                        <td className="py-3 px-4 align-top">
                          <RowActions
                            onEdit={item.transferKey ? undefined : () => beginEdit(item, index)}
                            onDelete={
                              index >= 0 || item.source === 'recurring' || item.source === 'balance' || item.descriptionText === 'Paycheck added' || !!item.transferKey
                                ? () => deleteRow(item, index)
                                : undefined
                            }
                            onMarkTransferIn={
                              index >= 0 && item.source !== 'balance' && item.source !== 'recurring'
                                ? () => markTransferredIn(index, item.source !== 'transfer-in')
                                : undefined
                            }
                            transferInLabel={item.source === 'transfer-in' ? 'Count as spending' : 'Transferred in'}
                          />
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Card layout for small screens */}
          <div className="block md:hidden space-y-4">
            {displayRows.map(({ item, index }) => (
              <div key={rowKey(item, index)} className="bg-white rounded-lg shadow-md p-4">
                {editingKey === rowKey(item, index) ? (
                  <>
                    <div className="mb-2">
                      <span className="text-xs text-gray-500 font-semibold">Merchant</span>
                      <input
                        type="text"
                        name="merchant"
                        value={editExpense?.merchant || ''}
                        onChange={handleEditChange}
                        disabled={identityLocked}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm form-input disabled:bg-gray-100"
                      />
                    </div>
                    <div className="mb-2">
                      <span className="text-xs text-gray-500 font-semibold">Date</span>
                      <input
                        type="date"
                        name="date"
                        value={editExpense?.date || ''}
                        onChange={handleEditChange}
                        disabled={dateLocked}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm form-input disabled:bg-gray-100"
                      />
                    </div>
                    <div className="mb-2">
                      <span className="text-xs text-gray-500 font-semibold">Amount</span>
                      <input
                        type="text"
                        name="amount"
                        value={editExpense?.amount || ''}
                        onChange={handleEditChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm form-input"
                      />
                      {editTarget?.kind === 'paycheck' && (
                        <span className="block text-xs text-gray-500 mt-1">Applies to every paycheck</span>
                      )}
                      {editTarget?.kind === 'recurring' && (
                        <span className="block text-xs text-gray-500 mt-1">Updates this monthly bill</span>
                      )}
                    </div>
                    <div className="mb-2">
                      <span className="text-xs text-gray-500 font-semibold">Estimated remaining</span>
                      <RemainingAmount value={remainingByKey.get(rowKey(item, index))} />
                    </div>
                    <div className="mb-2">
                      <span className="text-xs text-gray-500 font-semibold">Description</span>
                      <div className="mt-1">
                        <DescriptionField
                          value={editExpense?.description || ''}
                          otherText={editOtherText}
                          options={descriptionOptions}
                          disabled={identityLocked}
                          onValueChange={value => setEditExpense(current => current ? { ...current, description: value } : current)}
                          onOtherTextChange={setEditOtherText}
                          onAddChoice={label => {
                            const choice = addDescriptionChoice(label);
                            if (!choice) return;
                            setEditExpense(current => current ? { ...current, description: choice } : current);
                            setEditOtherText('');
                          }}
                          onDeleteChoice={deleteDescriptionChoice}
                        />
                      </div>
                    </div>
                    <div className="mb-2">
                      <span className="text-xs text-gray-500 font-semibold">Need</span>
                      <input
                        type="checkbox"
                        name="need"
                        checked={!!editExpense?.need}
                        onChange={handleEditChange}
                        disabled={identityLocked}
                        className="mt-1"
                      />
                    </div>
                    <div className="mb-2">
                      <span className="text-xs text-gray-500 font-semibold">Recurring</span>
                      <label className="mt-1 flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          name="recurringMonthly"
                          checked={!!editExpense?.recurringMonthly}
                          onChange={handleEditChange}
                          disabled={identityLocked}
                        />
                        Repeats monthly
                      </label>
                    </div>
                    <div className="mb-2">
                      <span className="text-xs text-gray-500 font-semibold">Status</span>
                      <select
                        name="status"
                        value={editExpense?.status || 'Scheduled'}
                        onChange={handleEditChange}
                        disabled={statusLocked}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm form-input disabled:bg-gray-100"
                      >
                        <option value="Scheduled">Scheduled</option>
                        <option value="Pending">Pending</option>
                        <option value="Upcoming">Upcoming</option>
                        <option value="Paid">Paid</option>
                      </select>
                    </div>
                    <div className="flex space-x-2 mt-4">
                      <button
                        onClick={handleSave}
                        className="bg-green-500 text-white py-2 px-3 rounded w-full"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancel}
                        className="bg-gray-500 text-white py-2 px-3 rounded w-full"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mb-2">
                      <span className="text-xs text-gray-500 font-semibold">Merchant</span>
                      <div className="font-medium text-gray-900">{item.merchant}</div>
                    </div>
                    <div className="mb-2">
                      <span className="text-xs text-gray-500 font-semibold">Date</span>
                      <div className="font-medium text-gray-900">{formatDateMMDDYYYY(item.date)}</div>
                    </div>
                    <div className="mb-2">
                      <span className="text-xs text-gray-500 font-semibold">Amount</span>
                      <div className={`font-bold ${amountClass(item)}`}>{item.amount}</div>
                    </div>
                    <div className="mb-2">
                      <span className="text-xs text-gray-500 font-semibold">Estimated remaining</span>
                      <RemainingAmount value={remainingByKey.get(rowKey(item, index))} />
                    </div>
                    <div className="mb-2">
                      <span className="text-xs text-gray-500 font-semibold">Description</span>
                      <DescriptionBadge value={item.description} />
                      {item.recurringMonthly && <div className="text-xs text-gray-500">Recurring monthly</div>}
                    </div>
                    <div className="mb-2">
                      <span className="text-xs text-gray-500 font-semibold">Need</span>
                      <div>
                        <i className={`fas ${item.need ? 'fa-check text-green-500' : 'fa-times text-red-500'}`}></i>
                      </div>
                    </div>
                    <div className="mb-2">
                      <span className="text-xs text-gray-500 font-semibold">Status</span>
                      <div>
                        {item.source === 'balance' ? (
                          <span className="bg-blue-500 text-white py-1 px-3 rounded">Recorded</span>
                        ) : (
                          <button className={`${statusClasses[item.status]} text-white py-1 px-3 rounded`}>
                            {item.status}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-end mt-2">
                      <RowActions
                        onEdit={item.transferKey ? undefined : () => beginEdit(item, index)}
                        onDelete={
                          index >= 0 || item.source === 'recurring' || item.source === 'balance' || item.descriptionText === 'Paycheck added' || !!item.transferKey
                            ? () => deleteRow(item, index)
                            : undefined
                        }
                        onMarkTransferIn={
                          index >= 0 && item.source !== 'balance' && item.source !== 'recurring'
                            ? () => markTransferredIn(index, item.source !== 'transfer-in')
                            : undefined
                        }
                        transferInLabel={item.source === 'transfer-in' ? 'Count as spending' : 'Transferred in'}
                      />
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
      </div>
      )}

      {panel === 'insights' && (
        <div className="space-y-8">
          <div>
            <h2 className="text-xl font-bold mb-4 text-center">Spending by Category</h2>
            <div className="flex justify-center">{monthTabs}</div>
            <div className="max-w-md mx-auto">
              <Pie data={pieData} />
            </div>
          </div>
          {suggestion && (
            <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded shadow">
              <strong>AI Suggestion:</strong> {suggestion}
              <button className="ml-4 text-sm text-blue-500" onClick={() => setSuggestion(null)}>Dismiss</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExpenseTracker; 