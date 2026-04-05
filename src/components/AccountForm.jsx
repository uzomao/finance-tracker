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
    <div className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4">
      <div className="w-full max-w-xl rounded-xl border border-gray-200 bg-gray-50 p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          {isEdit ? 'Edit Account' : 'Add Account'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading}
              type="text"
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Percentage</label>
            <input
              type="number"
              value={percentage}
              onChange={(e) => setPercentage(e.target.value)}
              min="0"
              max="100"
              step="0.01"
              required
              disabled={loading}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">
              Keywords (comma separated)
            </label>
            <input
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              disabled={loading}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>
          {error && (
            <p className="text-sm text-rose-600">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => navigate('/accounts')}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {loading ? 'Saving...' : isEdit ? 'Update' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AccountForm; 