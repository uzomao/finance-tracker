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

  if (loading) return <p className="text-sm text-slate-500">Loading accounts...</p>;
  if (error) return <p className="text-sm text-rose-600">{error}</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Accounts</h2>
        <button
          onClick={() => navigate('/accounts/new')}
          className="inline-flex items-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          Add Account
        </button>
      </div>
      {accounts.length === 0 ? (
        <p className="text-sm text-slate-500">No accounts found.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-xs md:text-sm">
            <thead className="bg-gray-50 text-[0.7rem] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Total Income</th>
                <th className="px-3 py-2">Total Expense</th>
                <th className="px-3 py-2">Balance</th>
                <th className="px-3 py-2">Percentage</th>
                <th className="px-3 py-2">Keywords</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => {
                const stats = accountStats[account.id] || { income: 0, expense: 0, balance: 0 };
                const balance = stats.balance ?? 0;
                return (
                  <tr key={account.id} className="border-t border-gray-100 last:border-b-0">
                    <td className="px-3 py-2 text-slate-800">{account.name}</td>
                    <td className="px-3 py-2 text-xs md:text-sm trans-income">
                      {naira.format(stats.income ?? 0)}
                    </td>
                    <td className="px-3 py-2 text-xs md:text-sm trans-expense">
                      {naira.format(stats.expense ?? 0)}
                    </td>
                    <td className="px-3 py-2 text-xs md:text-sm">
                      <span className={
                        balance < 0
                          ? 'trans-expense font-semibold'
                          : 'trans-income font-semibold'
                      }>
                        {naira.format(balance)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs md:text-sm">{account.percentage}%</td>
                    <td className="px-3 py-2 text-xs md:text-sm text-slate-600">
                      {account.keywords}
                    </td>
                    <td className="px-3 py-2 text-right text-xs md:text-sm">
                      <button
                        onClick={() => navigate(`/accounts/${account.id}/edit`)}
                        className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-gray-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(account.id)}
                        className="ml-2 inline-flex items-center rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AccountList; 