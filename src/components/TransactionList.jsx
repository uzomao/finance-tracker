import { useEffect, useState } from 'react';

function TransactionList() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  if (loading) return <p>Loading transactions...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  return (
    <div>
      <h2>Transactions</h2>
      {transactions.length === 0 ? (
        <p>No transactions found.</p>
      ) : (
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
            {transactions.map((t) => (
              <tr key={t.id}>
                <td>{t.date ? t.date.slice(0, 10) : ''}</td>
                <td>{t.amount.toFixed(2)}</td>
                <td>{t.account_name || t.account_id}</td>
                <td>{t.description}</td>
                <td>{t.source}</td>
                <td>{t.type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default TransactionList; 