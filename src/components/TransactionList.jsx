import { useEffect, useState } from 'react';

function TransactionList() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    fetch('http://localhost:3001/transactions')
      .then((res) => res.json())
      .then((data) => {
        setTransactions(data);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to fetch transactions');
        setLoading(false);
      });
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

  // Pagination logic
  const totalPages = Math.ceil(transactions.length / pageSize);
  const pagedTransactions = transactions.slice((page - 1) * pageSize, page * pageSize);
  const grouped = groupByMonth(pagedTransactions);
  const sortedMonths = Object.keys(grouped).sort((a, b) => b.localeCompare(a)); // Descending

  if (loading) return <p>Loading transactions...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  return (
    <div>
      <h2>Transactions</h2>
      <div style={{ marginBottom: '1.5rem' }}>
        <strong>Total Income:</strong> {naira.format(totalIncome)} &nbsp; | &nbsp;
        <strong>Total Expense:</strong> {naira.format(totalExpense)} &nbsp; | &nbsp;
        <strong>Net Balance:</strong> {naira.format(netBalance)}
      </div>
      {transactions.length === 0 ? (
        <p>No transactions found.</p>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount</th>
                <th>Account</th>
                <th>Description</th>
                <th>Source</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {sortedMonths.map((monthKey) => {
                const [year, month] = monthKey.split('-');
                return [
                  <tr key={monthKey} style={{ background: '#edf2f7' }}>
                    <td colSpan={6} style={{ fontWeight: 'bold' }}>
                      {monthNames[parseInt(month, 10) - 1]} {year}
                    </td>
                  </tr>,
                  ...grouped[monthKey].map((t) => (
                    <tr key={t.id} className={t.type === 'income' ? 'trans-income' : 'trans-expense'}>
                      <td>{t.date ? t.date.slice(0, 10) : ''}</td>
                      <td>{naira.format(t.amount)}</td>
                      <td>{t.account_name || t.account_id}</td>
                      <td>{t.description}</td>
                      <td>{t.source}</td>
                      <td>{t.type}</td>
                    </tr>
                  ))
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