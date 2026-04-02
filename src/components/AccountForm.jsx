import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getAccount, createAccount, updateAccount } from '../data/db';

function AccountForm() {
  const [name, setName] = useState('');
  const [percentage, setPercentage] = useState('');
  const [keywords, setKeywords] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  useEffect(() => {
    if (isEdit) {
      setLoading(true);
      let cancelled = false;
      (async () => {
        try {
          const data = await getAccount(id);
          if (!data) {
            throw new Error('Not found');
          }
          if (!cancelled) {
            setName(data.name);
            setPercentage(data.percentage);
            setKeywords(data.keywords);
            setLoading(false);
          }
        } catch (err) {
          if (!cancelled) {
            setError('Failed to load account');
            setLoading(false);
          }
        }
      })();

      return () => {
        cancelled = true;
      };
    }
  }, [id, isEdit]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    if (!name || percentage === '') {
      setError('Name and percentage are required');
      return;
    }
    setLoading(true);
    const payload = { name, percentage: parseFloat(percentage), keywords };
    const action = isEdit
      ? updateAccount(id, payload)
      : createAccount(payload);

    action
      .then(() => {
        navigate('/accounts');
      })
      .catch(() => {
        setError('Failed to save account');
        setLoading(false);
      });
  };

  return (
    <div>
      <h2>{isEdit ? 'Edit' : 'Add'} Account</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Name:</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={loading}
            type="text"
          />
        </div>
        <div>
          <label>Percentage:</label>
          <input
            type="number"
            value={percentage}
            onChange={(e) => setPercentage(e.target.value)}
            min="0"
            max="100"
            step="0.01"
            required
            disabled={loading}
          />
        </div>
        <div>
          <label>Keywords (comma separated):</label>
          <input
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            disabled={loading}
          />
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Saving...' : isEdit ? 'Update' : 'Add'}
        </button>
        <button type="button" onClick={() => navigate('/accounts')} disabled={loading} style={{ marginLeft: 8 }}>
          Cancel
        </button>
      </form>
    </div>
  );
}

export default AccountForm; 