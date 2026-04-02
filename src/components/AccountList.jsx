import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAccounts, getTransactions, deleteAccount as deleteAccountLocal } from '../data/db';

function AccountList() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [accountStats, setAccountStats] = useState({});
  const navigate = useNavigate();

  const naira = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [accountsData, transactions] = await Promise.all([
          getAccounts(),
          getTransactions(),
        ]);
        if (!cancelled) {
          setAccounts(accountsData);

          const stats = {};
          accountsData.forEach((acc) => {
            stats[acc.id] = { income: 0, expense: 0, balance: 0 };
          });

          transactions.forEach((tx) => {
            if (!tx.account_id || !stats[tx.account_id]) return;
            if (tx.type === 'income') {
              stats[tx.account_id].income += tx.amount;
            } else if (tx.type === 'expense') {
              stats[tx.account_id].expense += tx.amount;
            }
          });

          Object.values(stats).forEach((s) => {
            s.balance = s.income - s.expense;
          });

          setAccountStats(stats);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError('Failed to fetch accounts');
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleDelete = (id) => {
    if (!window.confirm('Delete this account?')) return;
    deleteAccountLocal(id)
      .then(() => {
        setAccounts((prev) => prev.filter((a) => a.id !== id));
      })
      .catch(() => setError('Failed to delete account'));
  };

  if (loading) return <p>Loading accounts...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  return (
    <div>
      <h2>Accounts</h2>
      <button onClick={() => navigate('/accounts/new')}>Add Account</button>
      {accounts.length === 0 ? (
        <p>No accounts found.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Total Income</th>
              <th>Total Expense</th>
              <th>Balance</th>
              <th>Percentage</th>
              <th>Keywords</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id}>
                <td>{account.name}</td>
                <td className="trans-income">{naira.format((accountStats[account.id]?.income ?? 0))}</td>
                <td className="trans-expense">{naira.format((accountStats[account.id]?.expense ?? 0))}</td>
                <td className={
                  (accountStats[account.id]?.balance ?? 0) < 0
                    ? 'trans-expense'
                    : 'trans-income'
                }>
                  {naira.format((accountStats[account.id]?.balance ?? 0))}
                </td>
                <td>{account.percentage}%</td>
                <td>{account.keywords}</td>
                <td>
                  <button onClick={() => navigate(`/accounts/${account.id}/edit`)}>Edit</button>
                  <button onClick={() => handleDelete(account.id)} style={{ marginLeft: 8 }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default AccountList; 