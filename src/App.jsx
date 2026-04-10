import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { AuthProvider, useAuthContext } from './contexts/AuthContext';
import { ProfileProvider, useProfileContext } from './contexts/ProfileContext';
import AuthScreen from './components/AuthScreen';
import Dashboard from './components/Dashboard';
import AccountList from './components/AccountList';
import AccountForm from './components/AccountForm';
import TransactionForm from './components/TransactionForm';
import TransactionList from './components/TransactionList';
import FileUpload from './components/FileUpload';
import { useState } from 'react';

function ProfileDropdown({ onClose, onSignOut }) {
  const { user } = useAuthContext();
  const { profile, refreshProfile } = useProfileContext();
  const [name, setName] = useState(profile?.displayName || user?.displayName || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const { updateProfile } = await import('firebase/auth');
      if (user) {
        await updateProfile(user, { displayName: name || null });
      }
      const { updateProfileFields } = await import('./data/profileService');
      await updateProfileFields({ displayName: name || null });
      await refreshProfile();
      onClose();
    } catch (e) {
      setError(e.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const email = user?.email || 'No email';

  return (
    <div className="absolute right-4 top-16 z-20 w-64 rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
      <h2 className="mb-2 text-sm font-semibold text-slate-900">Profile</h2>
      <p className="mb-2 text-xs text-slate-500 break-all">{email}</p>
      <div className="space-y-1 mb-3">
        <label className="block text-xs font-medium text-slate-700">Display name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={saving}
          className="block w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
        />
      </div>
      {error && <p className="mb-2 text-xs text-rose-600">{error}</p>}
      <div className="flex justify-between gap-2 text-xs">
        <button
          type="button"
          onClick={onSignOut}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-gray-50"
        >
          Log out
        </button>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-3 py-1.5 font-semibold text-white shadow-sm hover:bg-blue-700 disabled:bg-gray-300"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AppLayout() {
  const { user, signOutUser } = useAuthContext();
  const { profile } = useProfileContext();
  const [profileOpen, setProfileOpen] = useState(false);

  const { profile } = useProfileContext();
  console.log('Profile from context:', profile);

  const displayName = profile?.displayName || user?.displayName || user?.email || 'User';
  const initials = displayName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="min-h-screen bg-gray-50 text-slate-900">
      <div className="grid min-h-screen grid-rows-[80px_1fr] grid-cols-1 md:grid-cols-[240px_1fr] md:grid-rows-[80px_1fr]">
        {/* Header */}
        <header className="col-span-1 md:col-span-2 flex items-center justify-between border-b bg-white px-6 relative">
          <div className="flex-1" />
          <h1 className="text-xl md:text-2xl font-semibold text-slate-900 text-center">
            {displayName}'s Finance Tracker
          </h1>
          <div className="flex-1 flex justify-end items-center gap-3">
            <button
              type="button"
              onClick={() => setProfileOpen((v) => !v)}
              className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center text-sm font-medium text-slate-600 hover:bg-slate-300"
            >
              {initials}
            </button>
            {profileOpen && (
              <ProfileDropdown onClose={() => setProfileOpen(false)} onSignOut={signOutUser} />
            )}
          </div>
        </header>

        {/* Sidebar */}
        <aside className="hidden md:flex md:flex-col bg-white border-r py-4 px-3 space-y-4">
          <nav className="flex-1 flex flex-col gap-1 text-sm font-medium text-slate-700">
            <NavLink
              to="/new"
              className={({ isActive }) =>
                `inline-flex items-center gap-2 rounded-lg px-3 py-2 mb-1 text-sm font-semibold text-white bg-accent hover:bg-blue-700 bg-blue-500 ` +
                (isActive ? '' : '')
              }
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold">
                +
              </span>
              New Transaction
            </NavLink>
            <NavLink
              end
              to="/"
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 hover:bg-gray-100 flex items-center gap-2` +
                (isActive ? ' bg-gray-100 font-semibold' : '')
              }
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/transactions"
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 hover:bg-gray-100 flex items-center gap-2` +
                (isActive ? ' bg-gray-100 font-semibold' : '')
              }
            >
              Transactions
            </NavLink>
            <NavLink
              to="/accounts"
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 hover:bg-gray-100 flex items-center gap-2` +
                (isActive ? ' bg-gray-100 font-semibold' : '')
              }
            >
              Accounts
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 hover:bg-gray-100 flex items-center gap-2 text-slate-500` +
                (isActive ? ' bg-gray-100 font-semibold text-slate-900' : '')
              }
            >
              Settings
            </NavLink>
          </nav>
        </aside>

        {/* Main content */}
        <main className="col-span-1 flex flex-col bg-gray-50 px-4 py-4 md:px-6 md:py-6 overflow-y-auto">
          <div className="w-full max-w-6xl mx-auto">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/new" element={<TransactionForm />} />
              <Route path="/accounts" element={<AccountList />} />
              <Route path="/accounts/new" element={<AccountForm />} />
              <Route path="/accounts/:id/edit" element={<AccountForm />} />
              <Route path="/transactions" element={<TransactionList />} />
              <Route path="/upload" element={<FileUpload />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}

function AppWithAuth() {
  const { user, loading: authLoading } = useAuthContext();
  const { loading: profileLoading } = useProfileContext();

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-sm text-slate-600">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return <AppLayout />;
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <ProfileProvider>
          <AppWithAuth />
        </ProfileProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
