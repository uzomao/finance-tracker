import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

function AccountList() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('http://localhost:3001/accounts')
      .then((res) => res.json())
      .then((data) => {
        setAccounts(data);
        setLoading(false);
      })
      .catch((err) => {
        setError('Failed to fetch accounts');
        setLoading(false);
      });
  }, []);

  const handleDelete = (id) => {
    if (!window.confirm('Delete this account?')) return;
    fetch(`http://localhost:3001/accounts/${id}`, { method: 'DELETE' })
      .then((res) => {
        if (!res.ok) throw new Error('Delete failed');
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
              <th>Percentage</th>
              <th>Keywords</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id}>
                <td>{account.name}</td>
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