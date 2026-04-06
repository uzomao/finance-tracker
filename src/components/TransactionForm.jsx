import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAccounts, createIncomeWithAllocations, createExpense } from '../data/db';

export const formatDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

function TransactionForm() {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [type, setType] = useState('income');
  const [accountId, setAccountId] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [incomeAllocations, setIncomeAllocations] = useState([]);
  const [allocationEdited, setAllocationEdited] = useState(false);
  const navigate = useNavigate();
  const hiddenDateInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getAccounts();
        if (!cancelled) {
          setAccounts(data);
          setAccountsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError('Failed to load accounts');
          setAccountsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleAmountChange = (e) => {
    const input = e.target.value;
    const raw = input.replace(/,/g, '');

    if (raw === '') {
      setAmount('');
      setIncomeAllocations([]);
      setAllocationEdited(false);
      return;
    }

    // Allow only digits and one optional decimal point
    if (!/^\d*(\.\d*)?$/.test(raw)) {
      return;
    }

    const [intPart, decPart] = raw.split('.');
    const intFormatted = intPart ? Number(intPart).toLocaleString('en-NG') : '';
    const formatted = decPart !== undefined ? `${intFormatted}.${decPart}` : intFormatted;
    setAmount(formatted);
  };

  // Keep allocation breakdown (percentages -> amounts) in sync with amount/accounts
  useEffect(() => {
    const numericAmountForAlloc = amount ? parseFloat(String(amount).replace(/,/g, '')) : NaN;

    if (type !== 'income') {
      setIncomeAllocations([]);
      setAllocationEdited(false);
      return;
    }

    if (!amount || Number.isNaN(numericAmountForAlloc) || accounts.length === 0) {
      return;
    }

    setIncomeAllocations((prev) => {
      let base;

      if (prev.length === 0 || !allocationEdited) {
        // Use default account percentages when no custom edits yet
        base = accounts.map((acc) => ({
          account_id: acc.id,
          account_name: acc.name,
          percentage: acc.percentage,
        }));
      } else {
        // Preserve user-edited percentages but recalc amounts for new total
        base = prev;
      }

      return base.map((row) => ({
        ...row,
        amount: (numericAmountForAlloc * (Number(row.percentage) || 0)) / 100,
      }));
    });
  }, [type, accounts, amount, allocationEdited]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setResult(null);
    const numericAmount = parseFloat(String(amount).replace(/,/g, ''));
    if (!numericAmount || Number.isNaN(numericAmount)) {
      setError('Please enter a valid amount');
      setLoading(false);
      return;
    }

    // For income, if the user has edited the allocation, validate the custom breakdown
    let allocationsOverride;
    if (type === 'income' && allocationEdited && incomeAllocations.length > 0) {
      const totalPercentage = incomeAllocations.reduce(
        (sum, a) => sum + (Number(a.percentage) || 0),
        0
      );
      const diff = Math.abs(totalPercentage - 100);
      if (diff > 0.01) {
        setError('Total allocation percentages must equal 100%.');
        setLoading(false);
        return;
      }
      allocationsOverride = incomeAllocations.map((a) => ({
        account_id: a.account_id,
        amount: Number(a.amount) || 0,
      }));
    }
    const payload = {
      amount: numericAmount,
      description,
      type,
      date,
    };
    const action = type === 'income'
      ? createIncomeWithAllocations({ amount: payload.amount, description: payload.description, notes, date: payload.date, allocations: allocationsOverride })
      : createExpense({ amount: payload.amount, description: payload.description, account_id: accountId, notes, date: payload.date });

    action
      .then((data) => {
        setResult(data);
        setLoading(false);
        setAmount('');
        setDescription('');
        setNotes('');
        setAccountId('');
        setDate(new Date().toISOString().slice(0, 10));
        setIncomeAllocations([]);
        setAllocationEdited(false);
        navigate('/transactions')
      })
      .catch(() => {
        setError('Failed to save transaction');
        setLoading(false);
      });
  };

  const totalAllocated = incomeAllocations.reduce(
    (sum, a) => sum + (Number(a.amount) || 0),
    0
  );
  const totalPercentage = incomeAllocations.reduce(
    (sum, a) => sum + (Number(a.percentage) || 0),
    0
  );
  

  if (result) {
    return (
      <div className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4">
        <div className="w-full max-w-xl rounded-xl border border-gray-200 bg-gray-50 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            {type === 'income' ? 'Income Allocated' : 'Expense Recorded'}
          </h2>
          {type === 'income' ? (
            <>
              <p className="text-sm text-slate-700 mb-3">
                Total Income Transaction ID:{' '}
                <span className="font-semibold text-emerald-600">{result.totalIncomeId}</span>
              </p>
              <h3 className="text-sm font-semibold text-slate-800 mb-2">Allocations</h3>
              <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                <table className="min-w-full text-left text-xs md:text-sm">
                  <thead className="bg-gray-50 text-slate-500 uppercase tracking-wide text-[0.7rem]">
                    <tr>
                      <th className="px-3 py-2">Account ID</th>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.allocations.map((a, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-3 py-2 text-slate-700 text-xs md:text-sm">{a.account_id}</td>
                        <td className="px-3 py-2 text-xs md:text-sm text-emerald-600 font-medium">
                          {a.amount.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-slate-600 text-xs md:text-sm">{a.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="space-y-1 text-sm text-slate-700">
              <p>
                Expense Transaction ID:{' '}
                <span className="font-semibold">{result.id}</span>
              </p>
              <p>
                Amount:{' '}
                <span className="font-semibold text-rose-600">{result.amount}</span>
              </p>
              <p>
                Account ID:{' '}
                <span className="font-semibold">{result.account_id}</span>
              </p>
              <p>
                Description:{' '}
                <span className="font-medium">{result.description}</span>
              </p>
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => navigate('/accounts')}
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-gray-50"
            >
              Back to Accounts
            </button>
            <button
              type="button"
              onClick={() => setResult(null)}
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Add Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4">
      <div className="w-full max-w-xl rounded-xl border border-gray-200 bg-gray-50 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Log {type.charAt(0).toUpperCase() + type.slice(1)}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              disabled={loading || accountsLoading}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
            >
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
          </div>
          {type === 'expense' && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Account</label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                required
                disabled={loading || accountsLoading}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
              >
                <option value="">Select Account</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Amount</label>
            <input
              type="text"
              value={amount}
              onChange={handleAmountChange}
              required
              disabled={loading || accountsLoading}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading || accountsLoading}
              required
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Date</label>
            <div className="relative">
              <input
                type="text"
                value={formatDate(date)}
                onClick={() => {
                  if (hiddenDateInputRef.current) {
                    hiddenDateInputRef.current.showPicker?.();
                    hiddenDateInputRef.current.focus();
                  }
                }}
                readOnly
                disabled={loading || accountsLoading}
                required
                className="block w-full cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
              />
              <input
                ref={hiddenDateInputRef}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="absolute inset-0 h-0 w-0 opacity-0 pointer-events-none"
                tabIndex={-1}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={loading || accountsLoading}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>
          {error && (
            <p className="text-sm text-rose-600">
              {error}
            </p>
          )}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || accountsLoading}
              className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {loading
                ? type === 'income'
                  ? 'Allocating...'
                  : 'Saving...'
                : type === 'income'
                  ? 'Allocate Income'
                  : 'Save Expense'}
            </button>
          </div>

          {type === 'income' && incomeAllocations.length > 0 && (
            <div className="mt-4 space-y-3">
              <h4 className="text-sm font-semibold text-slate-800">Allocation Breakdown</h4>
              <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                <table className="min-w-full text-left text-xs md:text-sm">
                  <thead className="bg-gray-50 text-slate-500 uppercase tracking-wide text-[0.7rem]">
                    <tr>
                      <th className="px-3 py-2">Account</th>
                      <th className="px-3 py-2">Percentage</th>
                      <th className="px-3 py-2">Allocated Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incomeAllocations.map((a) => (
                      <tr key={a.account_id} className="border-t border-gray-100">
                        <td className="px-3 py-2 text-slate-700">{a.account_name}</td>
                        <td className="px-3 py-2 text-slate-700">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.01"
                              value={a.percentage ?? ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                const numeric = value === '' ? '' : Number(value);
                                setIncomeAllocations((prev) => {
                                  const next = prev.map((row) =>
                                    row.account_id === a.account_id
                                      ? { ...row, percentage: numeric }
                                      : row
                                  );
                                  const numericAmountForAlloc = amount
                                    ? parseFloat(String(amount).replace(/,/g, ''))
                                    : NaN;
                                  if (!Number.isNaN(numericAmountForAlloc)) {
                                    return next.map((row) => ({
                                      ...row,
                                      amount:
                                        (numericAmountForAlloc * (Number(row.percentage) || 0)) /
                                        100,
                                    }));
                                  }
                                  return next;
                                });
                                setAllocationEdited(true);
                              }}
                              disabled={loading || accountsLoading}
                              className="w-20 border-b border-gray-300 bg-transparent px-1 py-0.5 text-right text-xs md:text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                            />
                            <span className="text-xs text-slate-500">%</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs md:text-sm text-slate-700">
                          {(Number(a.amount) || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-600">
                Total percentage: <span className="font-semibold">{totalPercentage.toFixed(2)}%</span>{' '}
                &nbsp;|&nbsp; Total allocated:{' '}
                <span className="font-semibold">{totalAllocated.toFixed(2)}</span>
              </p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

export default TransactionForm; 