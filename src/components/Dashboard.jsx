import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAccounts } from '../data/db';
import { subscribeToTransactions } from '../data/transactionsRealtime';

function Card({ children, className = '' }) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl shadow-sm p-5 ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({ title, to }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-200 pb-3 mb-3 bg-gray-50 -m-5 px-5 pt-4 rounded-t-xl">
      <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
        {title}
      </h3>
      {to && (
        <Link
          to={to}
          className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-slate-800"
        >
          View all
          <span className="ml-1">↗</span>
        </Link>
      )}
    </div>
  );
}

function AccountBalance({ balance }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Account Balance
      </p>
      <p className="mt-2 text-3xl md:text-4xl font-bold text-slate-900">
        ₦{balance.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
    </Card>
  );
}

function IncomeExpenseCards({ totalIncome, totalExpense }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Total Income
        </p>
        <p className="mt-2 text-2xl font-bold text-emerald-600">
          ₦{totalIncome.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </Card>
      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Total Expense
        </p>
        <p className="mt-2 text-2xl font-bold text-rose-600">
          ₦{totalExpense.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </Card>
    </div>
  );
}

function AccountsList({ accounts }) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader title="Accounts" to="/accounts" />
      <div className="divide-y divide-gray-100">
        {accounts.length === 0 && (
          <p className="text-sm text-slate-500 py-3">No accounts yet.</p>
        )}
        {accounts.map((account) => (
          <div
            key={account.id}
            className="flex items-center justify-between py-2 text-sm"
          >
            <span className="text-slate-800 font-medium">{account.name}</span>
            <span className={
              account.balance < 0 ? 'text-rose-600 font-semibold' : 'text-emerald-600 font-semibold'
            }>
              ₦{account.balance.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function TransactionsTable({ transactions }) {
  // Only show parent transactions (exclude income allocation rows that have an account_id)
  const baseTransactions = transactions.filter(
    (tx) => !(tx.type === 'income' && tx.account_id != null)
  );

  return (
    <Card>
      <CardHeader title="Transactions" to="/transactions" />
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-4">Date</th>
              <th className="py-2 pr-4">Amount</th>
              <th className="py-2 pr-4">Sub-Account Debited</th>
              <th className="py-2">Description</th>
            </tr>
          </thead>
          <tbody>
            {baseTransactions.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="py-4 text-center text-sm text-slate-500"
                >
                  No transactions yet.
                </td>
              </tr>
            )}
            {baseTransactions.map((tx) => {
              const isIncome = tx.type === 'income';
              const amountClass = isIncome ? 'text-emerald-600' : 'text-rose-600';
              const date = tx.date ? new Date(tx.date) : null;
              const formattedDate = date
                ? date.toLocaleDateString('en-NG', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })
                : '';
              return (
                <tr key={tx.id} className="border-b border-gray-100 last:border-0">
                  <td className="py-2 pr-4 text-slate-700 text-xs md:text-sm">
                    {formattedDate}
                  </td>
                  <td className={`py-2 pr-4 text-xs md:text-sm font-semibold ${amountClass}`}>
                    ₦{tx.amount.toLocaleString('en-NG', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="py-2 pr-4 text-xs md:text-sm text-slate-700">
                    {tx.account_name || tx.account_id || '—'}
                  </td>
                  <td className="py-2 text-xs md:text-sm text-slate-600">
                    {tx.description || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Dashboard() {
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = null;

    (async () => {
      try {
        const accountsData = await getAccounts();
        if (cancelled) return;

        unsubscribe = await subscribeToTransactions(
          (transactionsData) => {
            if (cancelled) return;

            const stats = {};
            accountsData.forEach((acc) => {
              stats[acc.id] = { income: 0, expense: 0 };
            });

            transactionsData.forEach((tx) => {
              if (!tx.account_id || !stats[tx.account_id]) return;
              if (tx.type === 'income') {
                stats[tx.account_id].income += tx.amount;
              } else if (tx.type === 'expense') {
                stats[tx.account_id].expense += tx.amount;
              }
            });

            const accountsWithBalance = accountsData.map((acc) => {
              const s = stats[acc.id] || { income: 0, expense: 0 };
              return {
                ...acc,
                balance: s.income - s.expense,
              };
            });

            setAccounts(accountsWithBalance);
            setTransactions(transactionsData.slice(0, 8));
            setLoading(false);
          },
          () => {
            if (cancelled) return;
            setLoading(false);
          },
        );
      } catch (e) {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const totalIncome = transactions
    .filter((t) => t.type === 'income' && (t.account_id === null || t.account_id === undefined))
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  const balance = totalIncome - totalExpense;

  if (loading) {
    return <p className="text-sm text-slate-500">Loading dashboard...</p>;
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <AccountBalance balance={balance} />
      <IncomeExpenseCards totalIncome={totalIncome} totalExpense={totalExpense} />
      <div className="grid grid-cols-1 md:grid-cols-[0.35fr_0.65fr] gap-4 md:gap-6">
        <AccountsList accounts={accounts} />
        <TransactionsTable transactions={transactions} />
      </div>
    </div>
  );
}

export default Dashboard;