import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function IncomeForm() {
  const [amount, setAmount] = useState('');
  const [source, setSource] = useState('');
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
    fetch('http://localhost:3001/income', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: parseFloat(amount), source }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to allocate income');
        return res.json();
      })
      .then((data) => {
        setResult(data);
        setLoading(false);
        setAmount('');
        setSource('');
      })
      .catch(() => {
        setError('Failed to allocate income');
        setLoading(false);
      });
  };

  // Calculate allocation breakdown
  let allocation = [];
  if (accounts.length > 0 && amount && !isNaN(amount)) {
    allocation = accounts.map((acc) => ({
      ...acc,
      allocated: (parseFloat(amount) * acc.percentage) / 100,
    }));
  }

  if (result) {
    return (
      <div>
        <h2>Income Allocated!</h2>
        <p>Income ID: {result.incomeId}</p>
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
            {result.allocated.map((a, i) => (
              <tr key={i}>
                <td>{a.account_id}</td>
                <td>{a.amount.toFixed(2)}</td>
                <td>{a.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={() => navigate('/accounts')}>Back to Accounts</button>
        <button onClick={() => setResult(null)} style={{ marginLeft: 8 }}>Add Another</button>
      </div>
    );
  }

  return (
    <div>
      <h2>Log Income</h2>
      <form onSubmit={handleSubmit}>
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
          <label>Source:</label>
          <input
            type="text"
            value={source}
            onChange={(e) => setSource(e.target.value)}
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
          {loading ? 'Allocating...' : 'Allocate Income'}
        </button>
      </form>
    </div>
  );
}

export default IncomeForm; 