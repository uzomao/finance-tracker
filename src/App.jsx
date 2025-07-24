import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './App.css';
import Dashboard from './components/Dashboard';
import AccountList from './components/AccountList';
import AccountForm from './components/AccountForm';
import IncomeForm from './components/IncomeForm';
import TransactionList from './components/TransactionList';
import FileUpload from './components/FileUpload';

function App() {
  return (
    <Router>
      <nav className="navbar">
        <ul>
          <li><Link to="/">Dashboard</Link></li>
          <li><Link to="/accounts">Accounts</Link></li>
          <li><Link to="/income">Income</Link></li>
          <li><Link to="/transactions">Transactions</Link></li>
          <li><Link to="/upload">Upload</Link></li>
        </ul>
      </nav>
      <div className="container">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/accounts" element={<AccountList />} />
          <Route path="/accounts/new" element={<AccountForm />} />
          <Route path="/accounts/:id/edit" element={<AccountForm />} />
          <Route path="/income" element={<IncomeForm />} />
          <Route path="/transactions" element={<TransactionList />} />
          <Route path="/upload" element={<FileUpload />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
