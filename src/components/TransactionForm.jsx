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
      <div>
        <h2>{type === 'income' ? 'Income Allocated!' : 'Expense Recorded!'}</h2>
        {type === 'income' ? (
          <>
            <p>Total Income Transaction ID: <span className='trans-income'>{result.totalIncomeId}</span></p>
            <h3>Allocations:</h3>
            <table>
              <thead>
                <tr>
                  <th>Account ID</th>
                  <th>Amount</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {result.allocations.map((a, i) => (
                  <tr key={i}>
                    <td>{a.account_id}</td>
                    <td>{a.amount.toFixed(2)}</td>
                    <td>{a.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <>
            <p>Expense Transaction ID: {result.id}</p>
            <p>Amount: {result.amount}</p>
            <p>Account ID: {result.account_id}</p>
            <p>Description: {result.description}</p>
          </>
        )}
        <button onClick={() => navigate('/accounts')}>Back to Accounts</button>
        <button onClick={() => setResult(null)} style={{ marginLeft: 8 }}>Add Another</button>
      </div>
    );
  }

  return (
    <div>
      <h2>Log {type.charAt(0).toUpperCase() + type.slice(1)}</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Type:</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            disabled={loading || accountsLoading}
          >
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
        </div>
        {type === 'expense' && (
          <div>
            <label>Account:</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              required
              disabled={loading || accountsLoading}
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
        <div>
          <label>Amount:</label>
          <input
            type="text"
            value={amount}
            onChange={handleAmountChange}
            required
            disabled={loading || accountsLoading}
          />
        </div>
        <div>
          <label>Description:</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={loading || accountsLoading}
            required
          />
        </div>
        <div>
          <label>Date:</label>
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
          />
          <input
            ref={hiddenDateInputRef}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', height: 0, width: 0 }}
            tabIndex={-1}
          />
        </div>
        <div>
          <label>Notes:</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={loading || accountsLoading}
          />
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={loading || accountsLoading}>
          {loading ? (type === 'income' ? 'Allocating...' : 'Saving...') : (type === 'income' ? 'Allocate Income' : 'Save Expense')}
        </button>
        <br /><br />
        {type === 'income' && incomeAllocations.length > 0 && (
          <div style={{ margin: '1rem 0' }}>
            <h4>Allocation Breakdown</h4>
            <table>
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Percentage</th>
                  <th>Allocated Amount</th>
                </tr>
              </thead>
              <tbody>
                {incomeAllocations.map((a) => (
                  <tr key={a.account_id}>
                    <td>{a.account_name}</td>
                    <td>
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
                        style={{ width: '25%', border: 'none', borderBottom: '1px solid #ccc', borderRadius: 0 }}
                        disabled={loading || accountsLoading}
                      />
                      <span>{` `}%</span>
                    </td>
                    <td>{(Number(a.amount) || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ marginTop: '0.5rem' }}>
              Total percentage: {totalPercentage.toFixed(2)}% &nbsp; | &nbsp;
              Total allocated: {totalAllocated.toFixed(2)}
            </p>
          </div>
        )}
      </form>
    </div>
  );
}

export default TransactionForm; 