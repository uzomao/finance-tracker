import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './App.css';
import Dashboard from './components/Dashboard';
import AccountList from './components/AccountList';
import AccountForm from './components/AccountForm';
import TransactionForm from './components/TransactionForm';
import TransactionList from './components/TransactionList';
import FileUpload from './components/FileUpload';

function App() {
  return (
    <Router>
      <nav className="navbar">
        <ul>
          <li><Link to="/">New Transaction</Link></li>
          <li><Link to="/transactions">Transactions</Link></li>
          <li><Link to="/accounts">Accounts</Link></li>
        </ul>
      </nav>
      <div className="container">
        <Routes>
          <Route path="/" element={<TransactionForm />} />
          <Route path="/accounts" element={<AccountList />} />
          <Route path="/accounts/new" element={<AccountForm />} />
          <Route path="/accounts/:id/edit" element={<AccountForm />} />
          <Route path="/transactions" element={<TransactionList />} />
          <Route path="/upload" element={<FileUpload />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
