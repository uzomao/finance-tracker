import { useEffect, useState } from 'react';
import { getTransactions } from '../data/db';
import { formatDate } from './TransactionForm';

function TransactionList() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getTransactions();
        if (!cancelled) {
          setTransactions(data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError('Failed to fetch transactions');
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Currency formatter for Naira
  const naira = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  });

  // Calculate totals
  const totalIncome = transactions
    .filter((t) => t.type === 'income' && (t.account_id === null || t.account_id === undefined))
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  const netBalance = totalIncome - totalExpense;

  // Group transactions by month (YYYY-MM)
  const groupByMonth = (txs) => {
    return txs.reduce((groups, tx) => {
      const date = tx.date ? new Date(tx.date) : null;
      if (!date) return groups;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(tx);
      return groups;
    }, {});
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Build allocation index and base (non-allocation) list
  const allocationsByParent = transactions.reduce((map, tx) => {
    if (tx.type === 'income' && tx.account_id != null && tx.parent_income_id != null) {
      if (!map[tx.parent_income_id]) map[tx.parent_income_id] = [];
      map[tx.parent_income_id].push(tx);
    }
    return map;
  }, {});

  // Base list excludes all allocation-style income rows (any income with an account)
  const baseTransactions = transactions.filter(
    (t) => !(t.type === 'income' && t.account_id != null)
  );

  // Pagination logic
  const totalPages = Math.ceil(baseTransactions.length / pageSize);
  const pagedTransactions = baseTransactions.slice((page - 1) * pageSize, page * pageSize);
  const grouped = groupByMonth(pagedTransactions);
  const sortedMonths = Object.keys(grouped).sort((a, b) => b.localeCompare(a)); // Descending

  if (loading) return <p>Loading transactions...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  return (
    <div>
      <h2>Transactions</h2>
      <div style={{ marginBottom: '1.5rem' }}>
        <strong>Total Income:</strong> <span className='trans-income'>{naira.format(totalIncome)}</span> &nbsp; | &nbsp;
        <strong>Total Expense:</strong> <span className='trans-expense'>{naira.format(totalExpense)}</span> &nbsp; | &nbsp;
        <strong>Net Balance:</strong> <span className={netBalance >= 0 ? 'trans-income' : 'trans-expense'}>{naira.format(netBalance)}</span>
      </div>
      {transactions.length === 0 ? (
        <p>No transactions found.</p>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Date</th>
                <th>Amount</th>
                <th>Account</th>
                <th>Description</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {sortedMonths.map((monthKey) => {
                const [year, month] = monthKey.split('-');
                return [
                  <tr key={monthKey} style={{ background: '#edf2f7' }}>
                    <td colSpan={7} style={{ fontWeight: 'bold' }}>
                      {monthNames[parseInt(month, 10) - 1]} {year}
                    </td>
                  </tr>,
                  ...grouped[monthKey].flatMap((t) => {
                    const isParentIncome =
                      t.type === 'income' && (t.account_id === null || t.account_id === undefined);
                    const childAllocations = isParentIncome ? allocationsByParent[t.id] || [] : [];
                    const isExpanded = !!expanded[t.id];

                    const rows = [
                      <tr
                        key={t.id}
                        className={t.type === 'income' ? 'trans-income' : 'trans-expense'}
                      >
                        <td>
                          {isParentIncome && childAllocations.length > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpanded((prev) => ({
                                  ...prev,
                                  [t.id]: !prev[t.id],
                                }))
                              }
                              style={{ padding: '0 0.4rem' }}
                            >
                              {isExpanded ? '−' : '+'}
                            </button>
                          )}
                        </td>
                        <td>{formatDate(t.date)}</td>
                        <td>{naira.format(t.amount)}</td>
                        <td>{t.account_name || t.account_id}</td>
                        <td>{t.description}</td>
                        <td>{t.notes || t.source || ''}</td>
                      </tr>,
                    ];

                    if (isParentIncome && isExpanded && childAllocations.length > 0) {
                      childAllocations.forEach((a) => {
                        rows.push(
                          <tr key={`${t.id}-${a.id}`} className="trans-income">
                            <td></td>
                            <td>{formatDate(a.date)}</td>
                            <td>{naira.format(a.amount)}</td>
                            <td>{a.account_name || a.account_id}</td>
                            <td>{a.description}</td>
                            <td>{a.notes || ''}</td>
                            <td>{a.type}</td>
                          </tr>
                        );
                      });
                    }

                    return rows;
                  })
                ];
              })}
            </tbody>
          </table>
          <div style={{ marginTop: '1rem', textAlign: 'center' }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{ marginRight: 8 }}
            >
              Previous
            </button>
            Page {page} of {totalPages}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{ marginLeft: 8 }}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default TransactionList; 