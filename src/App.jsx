import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import AccountList from './components/AccountList';
import AccountForm from './components/AccountForm';
import TransactionForm from './components/TransactionForm';
import TransactionList from './components/TransactionList';
import FileUpload from './components/FileUpload';
import { startBackgroundSync } from './data/syncService';

function AppLayout() {
  return (
    <div className="min-h-screen bg-gray-50 text-slate-900">
      <div className="grid min-h-screen grid-rows-[80px_1fr] grid-cols-1 md:grid-cols-[240px_1fr] md:grid-rows-[80px_1fr]">
        {/* Header */}
        <header className="col-span-1 md:col-span-2 flex items-center justify-between border-b bg-white px-6">
          <div className="flex-1" />
          <h1 className="text-xl md:text-2xl font-semibold text-slate-900 text-center">
            uzoma.studio Finance Tracker
          </h1>
          <div className="flex-1 flex justify-end">
            <button
              type="button"
              className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center text-sm font-medium text-slate-600 hover:bg-slate-300"
            >
              UZ
            </button>
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

function App() {
  // Wire background sync into the app lifecycle. This keeps all components
  // simple – they only talk to the local db module, while this effect
  // periodically pushes pending changes to Firebase when enabled.
  useEffect(() => {
    const stop = startBackgroundSync({ intervalMs: 60000 });
    return () => stop();
  }, []);

  return (
    <Router>
      <AppLayout />
    </Router>
  );
}

export default App;
