import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function TransactionForm() {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('income');
  const [accountId, setAccountId] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('http://localhost:3001/accounts')
      .then((res) => res.json())
      .then((data) => {
        setAccounts(data);
        setAccountsLoading(false);
      })
      .catch(() => {
        setError('Failed to load accounts');
        setAccountsLoading(false);
      });
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setResult(null);
    const payload = {
      amount: parseFloat(amount),
      description,
      type,
    };
    if (type === 'expense') {
      payload.account_id = accountId;
    }
    fetch('http://localhost:3001/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to save transaction');
        return res.json();
      })
      .then((data) => {
        setResult(data);
        setLoading(false);
        setAmount('');
        setDescription('');
        setAccountId('');
      })
      .catch(() => {
        setError('Failed to save transaction');
        setLoading(false);
      });
  };

  // Calculate allocation breakdown
  let allocation = [];
  if (type === 'income' && accounts.length > 0 && amount && !isNaN(amount)) {
    allocation = accounts.map((acc) => ({
      ...acc,
      allocated: (parseFloat(amount) * acc.percentage) / 100,
    }));
  }

  if (result) {
    return (
      <div>
        <h2>{type === 'income' ? 'Income Allocated!' : 'Expense Recorded!'}</h2>
        {type === 'income' ? (
          <>
            <p>Total Income Transaction ID: {result.totalIncomeId}</p>
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
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="0"
            step="0.01"
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
          />
        </div>
        {allocation.length > 0 && (
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
                {allocation.map((a) => (
                  <tr key={a.id}>
                    <td>{a.name}</td>
                    <td>{a.percentage}%</td>
                    <td>{a.allocated.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={loading || accountsLoading}>
          {loading ? (type === 'income' ? 'Allocating...' : 'Saving...') : (type === 'income' ? 'Allocate Income' : 'Save Expense')}
        </button>
      </form>
    </div>
  );
}

export default TransactionForm; 