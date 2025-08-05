import React, { useState, useEffect } from 'react';
import { Pie } from 'react-chartjs-2';
import { Chart, ArcElement, Tooltip, Legend } from 'chart.js';
Chart.register(ArcElement, Tooltip, Legend);

interface ExpenseItem {
  merchant: string;
  date: string;
  amount: string;
  description: string;
  descriptionText?: string;
  need: boolean;
  status: 'Scheduled' | 'Pending' | 'Upcoming' | 'Paid';
}

const statusClasses = {
  Scheduled: 'bg-blue-500',
  Pending: 'bg-yellow-500',
  Upcoming: 'bg-purple-500',
  Paid: 'bg-green-500',
};

const initialData: ExpenseItem[] = [
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

const descriptionOptions = [
  "subscription",
  "groceries",
  "utilities",
  "transportation",
  "insurance",
  "entertainment",
  "Other"
];

// Utility functions for date formatting and month extraction
function formatDateMMDDYYYY(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}
function getMonthYear(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function getMonthLabel(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return `${d.toLocaleString('default', { month: 'long' })} ${d.getFullYear()}`;
}

const ExpenseTracker: React.FC<{ username: string }> = ({ username }) => {
  const normalizedUsername = username.trim().toLowerCase();
  const [spendingData, setSpendingData] = useState<ExpenseItem[]>(initialData);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
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

  // Load expenses for this user on mount/username change
  useEffect(() => {
    const saved = localStorage.getItem(`expenses_${normalizedUsername}`);
    if (saved) {
      setSpendingData(JSON.parse(saved));
    } else {
      setSpendingData(initialData);
    }
  }, [normalizedUsername]);

  // Save expenses for this user whenever they change
  useEffect(() => {
    const key = `expenses_${normalizedUsername}`;
    console.log('Saving data with key:', key);
    const updatedData = [...spendingData];
    console.log('Data being saved:', updatedData);
    localStorage.setItem(key, JSON.stringify(updatedData));
  }, [spendingData, normalizedUsername]);

  useEffect(() => {
    // Simple AI: find the largest category
    if (spendingData.length === 0) return;
    const maxCat = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
    if (maxCat && maxCat[1] > 100) { // threshold for suggestion
      setSuggestion(`You spent $${maxCat[1].toFixed(2)} on ${maxCat[0]}. Consider reducing this category to save money!`);
    } else {
      setSuggestion(null);
    }
  }, [spendingData]);

  // Get all unique months from spendingData
  const monthSet = new Set<string>();
  spendingData.forEach(exp => {
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
  const filteredData = selectedMonth === 'all'
    ? spendingData
    : spendingData.filter(exp => getMonthYear(exp.date) === selectedMonth);

  // Calculate category totals for filtered data
  const categoryTotals: { [key: string]: number } = {};
  filteredData.forEach(exp => {
    const cat = exp.description.toLowerCase();
    const amt = parseFloat(exp.amount.replace('$', '')) || 0;
    categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
  });

  const pieData = {
    labels: Object.keys(categoryTotals).map(
      cat => cat.charAt(0).toUpperCase() + cat.slice(1)
    ),
    datasets: [
      {
        data: Object.values(categoryTotals),
        backgroundColor: [
          '#60a5fa', // blue
          '#34d399', // green
          '#fbbf24', // yellow
          '#f87171', // red
          '#a78bfa', // purple
          '#f472b6', // pink
          '#facc15', // gold
          '#6ee7b7', // teal
        ],
      },
    ],
  };

  const handleAddExpense = () => {
    const description =
      newExpense.description === "Other"
        ? newExpense.descriptionText || ""
        : newExpense.description;
    const formattedExpense: ExpenseItem = {
      ...newExpense,
      description,
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

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setEditExpense({ ...spendingData[index] });
  };

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

  const handleSave = (index: number) => {
    if (!editExpense) return;
    const updatedData = [...spendingData];
    updatedData[index] = {
      ...editExpense,
      amount: typeof editExpense.amount === 'string' ? editExpense.amount : `$${Number(editExpense.amount).toFixed(2)}`,
    };
    setSpendingData(updatedData);
    // Save updated data to localStorage immediately
    const key = `expenses_${normalizedUsername}`;
    console.log('Saving data with key:', key);
    console.log('Data being saved:', updatedData);
    localStorage.setItem(key, JSON.stringify(updatedData));
    setEditingIndex(null);
    setEditExpense(null);
  };

  const handleCancel = () => {
    setEditingIndex(null);
    setEditExpense(null);
  };

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

      {showAddForm && (
        <div className="mb-8 p-6 bg-white rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4">Add New Expense</h2>
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
              <select
                value={newExpense.description}
                onChange={e => setNewExpense({ ...newExpense, description: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm form-input"
                required
              >
                <option value="">Select...</option>
                {descriptionOptions.map(opt => (
                  <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
                ))}
              </select>
              {newExpense.description === "Other" && (
                <input
                  type="text"
                  placeholder="Enter description"
                  value={newExpense.descriptionText || ""}
                  onChange={e => setNewExpense({ ...newExpense, descriptionText: e.target.value })}
                  className="mt-2 block w-full rounded-md border-gray-300 shadow-sm form-input"
                  required
                />
              )}
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
          <div className="mt-4 flex justify-end space-x-2">
            <button
              onClick={() => setShowAddForm(false)}
              className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 btn"
            >
              Cancel
            </button>
            <button
              onClick={handleAddExpense}
              className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 btn"
            >
              Add Expense
            </button>
          </div>
        </div>
      )}

      {/* Table and Chart stacked vertically */}
      <div className="space-y-8">
        <div>
          {/* Table for md+ screens */}
          <div className="w-full overflow-x-auto hidden md:block">
            <table className="min-w-full w-full bg-white rounded-lg overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Merchant</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Need</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {spendingData.map((item, index) => (
                  <tr key={index} className="border-b">
                    {editingIndex === index ? (
                      <>
                        <td className="py-3 px-4 align-top">
                          <span className="block md:hidden text-xs text-gray-500 font-semibold mb-1">Merchant</span>
                          <input
                            type="text"
                            name="merchant"
                            value={editExpense?.merchant || ''}
                            onChange={handleEditChange}
                            className="block w-full rounded-md border-gray-300 shadow-sm form-input"
                          />
                        </td>
                        <td className="py-3 px-4 align-top">
                          <span className="block md:hidden text-xs text-gray-500 font-semibold mb-1">Date</span>
                          <input
                            type="date"
                            name="date"
                            value={editExpense?.date || ''}
                            onChange={handleEditChange}
                            className="block w-full rounded-md border-gray-300 shadow-sm form-input"
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
                        </td>
                        <td className="py-3 px-4 align-top">
                          <span className="block md:hidden text-xs text-gray-500 font-semibold mb-1">Description</span>
                          <input
                            type="text"
                            name="description"
                            value={editExpense?.description || ''}
                            onChange={handleEditChange}
                            className="block w-full rounded-md border-gray-300 shadow-sm form-input"
                          />
                        </td>
                        <td className="py-3 px-4 align-top">
                          <span className="block md:hidden text-xs text-gray-500 font-semibold mb-1">Need</span>
                          <input
                            type="checkbox"
                            name="need"
                            checked={!!editExpense?.need}
                            onChange={handleEditChange}
                            className="mt-1"
                          />
                        </td>
                        <td className="py-3 px-4 align-top">
                          <span className="block md:hidden text-xs text-gray-500 font-semibold mb-1">Status</span>
                          <select
                            name="status"
                            value={editExpense?.status || 'Scheduled'}
                            onChange={handleEditChange}
                            className="block w-full rounded-md border-gray-300 shadow-sm form-input"
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
                              onClick={() => handleSave(index)}
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
                          <span className="block md:inline mt-1 md:mt-0 text-green-600 font-bold">{item.amount}</span>
                        </td>
                        <td className="py-3 px-4 align-top">
                          <span className="block md:hidden text-xs text-gray-500 font-semibold mb-1">Description</span>
                          <span className="block md:inline mt-1 md:mt-0">{item.description}</span>
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
                            <button className={`${statusClasses[item.status]} text-white py-1 px-3 rounded`}>
                              {item.status}
                            </button>
                          </span>
                        </td>
                        <td className="py-3 px-4 align-top">
                          <div className="flex flex-col xl:flex-row space-y-2 xl:space-y-0 xl:space-x-2">
                            <button
                              onClick={() => handleDelete(index)}
                              className="bg-red-500 text-white py-2 px-3 rounded w-full xl:w-auto"
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => handleEdit(index)}
                              className="bg-yellow-500 text-white py-2 px-3 rounded w-full xl:w-auto"
                            >
                              Edit
                            </button>
                          </div>
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
            {spendingData.map((item, index) => (
              <div key={index} className="bg-white rounded-lg shadow-md p-4">
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
                  <div className="font-bold text-green-600">{item.amount}</div>
                </div>
                <div className="mb-2">
                  <span className="text-xs text-gray-500 font-semibold">Description</span>
                  <div className="font-medium text-gray-900">{item.description}</div>
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
                    <button className={`${statusClasses[item.status]} text-white py-1 px-3 rounded`}>
                      {item.status}
                    </button>
                  </div>
                </div>
                <div className="flex space-x-2 mt-4">
                  <button
                    onClick={() => handleDelete(index)}
                    className="bg-red-500 text-white py-2 px-3 rounded w-full"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => handleEdit(index)}
                    className="bg-yellow-500 text-white py-2 px-3 rounded w-full"
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-xl font-bold mb-4 text-center">Spending by Category</h2>
          {/* Month Tabs */}
          <div className="flex flex-wrap justify-center mb-4 gap-2">
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
          <div className="max-w-md mx-auto">
            <Pie data={pieData} />
          </div>
        </div>
      </div>

      {suggestion && (
        <div className="fixed bottom-8 right-8 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded shadow-lg z-50">
          <strong>AI Suggestion:</strong> {suggestion}
          <button className="ml-4 text-sm text-blue-500" onClick={() => setSuggestion(null)}>Dismiss</button>
        </div>
      )}
    </div>
  );
};

export default ExpenseTracker; 